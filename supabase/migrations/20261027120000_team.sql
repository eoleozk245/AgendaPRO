-- Etapa 7a (D-020): equipe com vários profissionais.
--  * o agendamento exige profissional ativo que faça o serviço;
--  * set_professional_services define, numa transação só, quais serviços um
--    profissional faz (roda com as permissões de quem chama: a RLS vale).

-- ---------------------------------------------------------------------------
-- Regras do agendamento: mesma função da Etapa 4, com a checagem de equipe.
-- ---------------------------------------------------------------------------
create or replace function private.appointments_before_write()
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

  -- Equipe (D-020): só profissional ativo, e só serviço que ele faz. Checado ao
  -- criar ou ao trocar profissional/serviço; mudar só o estado (ex.: cancelar
  -- agendamento antigo de quem foi desativado) continua permitido.
  if tg_op = 'INSERT' or new.professional_id <> old.professional_id
     or new.service_id <> old.service_id then
    if not exists (
      select 1 from public.professionals p
      where p.id = new.professional_id
        and p.organization_id = new.organization_id
        and p.active
    ) then
      raise exception 'Esse profissional está inativo.' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.professional_services ps
      where ps.professional_id = new.professional_id
        and ps.service_id = new.service_id
    ) then
      raise exception 'Esse profissional não faz esse serviço.' using errcode = 'P0001';
    end if;
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

-- ---------------------------------------------------------------------------
-- Serviços que um profissional faz (substitui a lista inteira).
-- ---------------------------------------------------------------------------
create function public.set_professional_services(
  p_professional_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org uuid;
begin
  -- A RLS só deixa ver profissionais do próprio estabelecimento.
  select p.organization_id into org
  from public.professionals p
  where p.id = p_professional_id;
  if org is null then
    raise exception 'Profissional não encontrado.' using errcode = 'P0001';
  end if;

  delete from public.professional_services ps
  where ps.professional_id = p_professional_id
    and not (ps.service_id = any (coalesce(p_service_ids, '{}')));

  -- Só serviços do mesmo estabelecimento; IDs de fora são ignorados.
  insert into public.professional_services (organization_id, professional_id, service_id)
  select org, p_professional_id, s.id
  from public.services s
  where s.organization_id = org
    and s.id = any (coalesce(p_service_ids, '{}'))
  on conflict do nothing;
end;
$$;

revoke all on function public.set_professional_services(uuid, uuid[]) from public, anon;
grant execute on function public.set_professional_services(uuid, uuid[]) to authenticated;
