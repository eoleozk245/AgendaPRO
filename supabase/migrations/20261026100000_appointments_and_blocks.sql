-- Etapa 4: agendamentos e bloqueios de agenda.
-- Garantias no banco (D-007, D-008, D-009):
--   * dois agendamentos ativos do mesmo profissional nunca se sobrepõem (exclusion constraint);
--   * preço, duração e nome do serviço são copiados no momento da reserva;
--   * só as transições de estado permitidas passam;
--   * agendamento não cai em cima de bloqueio, e bloqueio não cai em cima de agendamento.

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  -- Fica nulo se o cliente for apagado (LGPD): o histórico continua, sem dado pessoal.
  client_id uuid,
  -- Cópias do momento da reserva. Mudar o serviço depois não altera o agendamento.
  service_name text not null,
  duration_minutes integer not null
    constraint appointments_duration_valid check (duration_minutes between 5 and 480),
  price_cents integer not null
    constraint appointments_price_valid check (price_cents >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    constraint appointments_status_valid
      check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source text not null default 'panel'
    constraint appointments_source_valid check (source in ('panel', 'public')),
  notes text
    constraint appointments_notes_length check (char_length(notes) <= 500),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_interval_valid check (ends_at > starts_at),
  constraint appointments_professional_fkey foreign key (professional_id, organization_id)
    references public.professionals (id, organization_id) on delete restrict,
  constraint appointments_service_fkey foreign key (service_id, organization_id)
    references public.services (id, organization_id) on delete restrict,
  constraint appointments_client_fkey foreign key (client_id, organization_id)
    references public.clients (id, organization_id) on delete set null (client_id),
  -- O coração da agenda: o banco recusa sobreposição para o mesmo profissional.
  -- Intervalo meio-aberto [início, fim): 10:00-10:30 e 10:30-11:00 não conflitam.
  -- Cancelados não ocupam horário.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);

create index appointments_organization_starts_idx on public.appointments (organization_id, starts_at);
create index appointments_service_idx on public.appointments (service_id, organization_id);
create index appointments_client_idx on public.appointments (client_id, organization_id);

-- ---------------------------------------------------------------------------
-- availability_blocks: períodos em que o profissional não atende (folga, almoço extra...).
-- ---------------------------------------------------------------------------
create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text
    constraint availability_blocks_reason_length check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  constraint availability_blocks_interval_valid check (ends_at > starts_at),
  constraint availability_blocks_professional_fkey foreign key (professional_id, organization_id)
    references public.professionals (id, organization_id) on delete cascade
);

create index availability_blocks_professional_starts_idx
  on public.availability_blocks (professional_id, starts_at);
create index availability_blocks_organization_idx on public.availability_blocks (organization_id);

-- ---------------------------------------------------------------------------
-- Regras do agendamento (trigger BEFORE INSERT/UPDATE)
-- ---------------------------------------------------------------------------
create function private.appointments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  svc public.services;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'Não é possível mover o agendamento para outro estabelecimento.'
        using errcode = '42501';
    end if;

    -- Transições permitidas (D-009). Qualquer outra é recusada.
    if new.status <> old.status and not (
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
      (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show'))
    ) then
      raise exception 'Transição de estado inválida: % para %.', old.status, new.status
        using errcode = 'P0001';
    end if;

    -- Estados finais não mudam mais de horário, serviço ou profissional.
    if old.status in ('completed', 'cancelled', 'no_show') and (
      new.starts_at <> old.starts_at or new.service_id <> old.service_id
      or new.professional_id <> old.professional_id
    ) then
      raise exception 'Agendamento encerrado não pode ser alterado.'
        using errcode = 'P0001';
    end if;

    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_at := now();
    end if;
  else
    if new.status not in ('pending', 'confirmed') then
      raise exception 'Um agendamento novo começa como pendente ou confirmado.'
        using errcode = 'P0001';
    end if;
    new.cancelled_at := null;
  end if;

  -- Cópia do serviço: no insert e quando o serviço muda. Valores enviados pelo
  -- cliente para preço/duração/nome são sempre ignorados.
  if tg_op = 'INSERT' or new.service_id <> old.service_id then
    select * into svc
    from public.services s
    where s.id = new.service_id and s.organization_id = new.organization_id;
    if not found then
      raise exception 'Serviço não encontrado.' using errcode = '23503';
    end if;
    new.service_name := svc.name;
    new.duration_minutes := svc.duration_minutes;
    new.price_cents := svc.price_cents;
  else
    new.service_name := old.service_name;
    new.duration_minutes := old.duration_minutes;
    new.price_cents := old.price_cents;
  end if;

  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);

  -- Serializa gravações do mesmo profissional para a checagem de bloqueio
  -- abaixo não sofrer com duas transações simultâneas.
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));

  if new.status <> 'cancelled' and exists (
    select 1
    from public.availability_blocks b
    where b.professional_id = new.professional_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Esse horário está bloqueado na agenda.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger appointments_before_write
before insert or update on public.appointments
for each row execute function private.appointments_before_write();

create trigger appointments_set_updated_at before update on public.appointments
for each row execute function private.set_updated_at();

-- Bloqueio não pode cair em cima de agendamento ativo.
create function private.availability_blocks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));
  if exists (
    select 1
    from public.appointments a
    where a.professional_id = new.professional_id
      and a.status <> 'cancelled'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Já existe agendamento nesse período. Cancele ou remarque antes de bloquear.'
      using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger availability_blocks_before_write
before insert or update on public.availability_blocks
for each row execute function private.availability_blocks_before_write();

revoke all on function private.appointments_before_write() from public;
revoke all on function private.availability_blocks_before_write() from public;

-- ---------------------------------------------------------------------------
-- Privilégios e RLS. Agendamento não é apagado: é cancelado (fica no histórico).
-- ---------------------------------------------------------------------------
revoke all on public.appointments, public.availability_blocks from anon, authenticated;

grant select on public.appointments to authenticated;
grant insert (organization_id, professional_id, service_id, client_id, starts_at, status, notes)
  on public.appointments to authenticated;
grant update (professional_id, service_id, client_id, starts_at, status, notes)
  on public.appointments to authenticated;
grant select, insert, update, delete on public.availability_blocks to authenticated;

alter table public.appointments enable row level security;
alter table public.availability_blocks enable row level security;

create policy "Membros leem" on public.appointments for select to authenticated
  using ((select private.is_member(organization_id)));
create policy "Donos criam" on public.appointments for insert to authenticated
  with check ((select private.is_owner(organization_id)));
create policy "Donos editam" on public.appointments for update to authenticated
  using ((select private.is_owner(organization_id)))
  with check ((select private.is_owner(organization_id)));

create policy "Membros leem" on public.availability_blocks for select to authenticated
  using ((select private.is_member(organization_id)));
create policy "Donos criam" on public.availability_blocks for insert to authenticated
  with check ((select private.is_owner(organization_id)));
create policy "Donos editam" on public.availability_blocks for update to authenticated
  using ((select private.is_owner(organization_id)))
  with check ((select private.is_owner(organization_id)));
create policy "Donos apagam" on public.availability_blocks for delete to authenticated
  using ((select private.is_owner(organization_id)));
