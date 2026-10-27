-- Etapa 5: página pública de agendamento.
-- O visitante (anon) nunca toca nas tabelas: só chama três funções que validam
-- tudo no banco (D-008). A reserva tem limite de tentativas contra abuso.

-- ---------------------------------------------------------------------------
-- Regras de reserva por estabelecimento (D-016).
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column booking_min_notice_minutes integer not null default 120
    constraint organizations_min_notice_valid check (booking_min_notice_minutes between 0 and 10080),
  add column booking_max_days_ahead integer not null default 60
    constraint organizations_max_days_valid check (booking_max_days_ahead between 1 and 365);

grant update (booking_min_notice_minutes, booking_max_days_ahead) on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- Registro de tentativas de reserva (limite de requisições). Fica no schema
-- private: não é exposto pela API e guarda o mínimo pelo menor tempo possível.
-- ---------------------------------------------------------------------------
create table private.booking_attempts (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  ip text,
  created_at timestamptz not null default now()
);

create index booking_attempts_ip_idx on private.booking_attempts (ip, created_at);
create index booking_attempts_org_idx on private.booking_attempts (organization_id, created_at);

revoke all on private.booking_attempts from public, anon, authenticated;

-- IP de quem chamou, a partir dos cabeçalhos repassados pelo Supabase (PostgREST).
create function private.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
    ''
  ), ',', 1)), '');
$$;

revoke all on function private.request_ip() from public;

-- ---------------------------------------------------------------------------
-- 1. Dados da página: estabelecimento, serviços ativos e profissionais.
-- ---------------------------------------------------------------------------
create function public.get_public_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'name', o.name,
      'slug', o.slug,
      'timezone', o.timezone,
      'min_notice_minutes', o.booking_min_notice_minutes,
      'max_days_ahead', o.booking_max_days_ahead
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'description', s.description,
        'duration_minutes', s.duration_minutes, 'price_cents', s.price_cents
      ) order by s.name)
      from public.services s
      where s.organization_id = o.id and s.active
        and exists (
          select 1 from public.professional_services ps
          join public.professionals p on p.id = ps.professional_id and p.active
          where ps.service_id = s.id
        )
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'service_ids', (
          select coalesce(jsonb_agg(ps.service_id), '[]'::jsonb)
          from public.professional_services ps where ps.professional_id = p.id
        )
      ) order by p.created_at)
      from public.professionals p
      where p.organization_id = o.id and p.active
    ), '[]'::jsonb)
  )
  from public.organizations o
  where o.slug = lower(btrim(p_slug));
$$;

-- ---------------------------------------------------------------------------
-- 2. Horários livres de um dia. De 15 em 15 minutos, dentro do expediente,
--    respeitando antecedência mínima, limite de dias, agendamentos e bloqueios.
-- ---------------------------------------------------------------------------
create function public.get_available_slots(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date
)
returns table (starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org public.organizations;
  svc public.services;
  local_today date;
begin
  select * into org from public.organizations where slug = lower(btrim(p_slug));
  if not found then
    return;
  end if;

  select s.* into svc
  from public.services s
  join public.professional_services ps on ps.service_id = s.id and ps.professional_id = p_professional_id
  join public.professionals p on p.id = ps.professional_id and p.active
  where s.id = p_service_id and s.organization_id = org.id and s.active;
  if not found then
    return;
  end if;

  local_today := (now() at time zone org.timezone)::date;
  if p_date < local_today or p_date > local_today + org.booking_max_days_ahead then
    return;
  end if;

  return query
  with candidates as (
    -- Passo de 15 minutos a partir da abertura, cabendo a duração inteira antes do fechamento.
    select ((p_date + bh.opens_at + make_interval(mins => g.offset_minutes)) at time zone org.timezone)
      as slot_start
    from public.business_hours bh
    cross join lateral generate_series(
      0,
      (extract(epoch from (bh.closes_at - bh.opens_at)) / 60)::integer - svc.duration_minutes,
      15
    ) as g(offset_minutes)
    where bh.organization_id = org.id
      and bh.weekday = extract(dow from p_date)
  )
  select c.slot_start
  from candidates c
  where c.slot_start >= now() + make_interval(mins => org.booking_min_notice_minutes)
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = p_professional_id
        and a.status <> 'cancelled'
        and tstzrange(a.starts_at, a.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_start + make_interval(mins => svc.duration_minutes), '[)')
    )
    and not exists (
      select 1 from public.availability_blocks b
      where b.professional_id = p_professional_id
        and tstzrange(b.starts_at, b.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_start + make_interval(mins => svc.duration_minutes), '[)')
    )
  order by c.slot_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reservar. Valida tudo de novo (o horário precisa estar entre os livres),
--    aplica o limite de tentativas, acha ou cria o cliente pelo telefone e
--    cria o agendamento como "pendente" para o estabelecimento confirmar.
--
--    Erros de validação voltam como {"ok": false, "message": ...} em vez de
--    exceção: assim o registro da tentativa não é desfeito e o limite conta
--    também as tentativas que falham.
-- ---------------------------------------------------------------------------
create function public.book_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org public.organizations;
  caller_ip text := private.request_ip();
  clean_name text := btrim(coalesce(p_client_name, ''));
  clean_phone text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  found_client_id uuid;
  new_appointment public.appointments;
begin
  select * into org from public.organizations where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Estabelecimento não encontrado.');
  end if;

  -- Guarda só as últimas 24 horas de tentativas.
  delete from private.booking_attempts where created_at < now() - interval '1 day';

  -- Limites contra abuso (D-016).
  if caller_ip is not null and (
    select count(*) from private.booking_attempts
    where ip = caller_ip and created_at > now() - interval '10 minutes'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'message',
      'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.');
  end if;
  if (
    select count(*) from private.booking_attempts
    where organization_id = org.id and created_at > now() - interval '1 minute'
  ) >= 30 then
    return jsonb_build_object('ok', false, 'message',
      'Muitas reservas ao mesmo tempo. Tente de novo em instantes.');
  end if;

  insert into private.booking_attempts (organization_id, ip) values (org.id, caller_ip);

  -- Bloco interno: se algo falhar aqui, só ele é desfeito (a tentativa fica registrada).
  begin
    if char_length(clean_name) not between 2 and 120 then
      raise exception 'Informe seu nome (de 2 a 120 caracteres).';
    end if;
    if clean_phone !~ '^[1-9][0-9]{9,10}$' then
      raise exception 'Informe um telefone com DDD, por exemplo (11) 98765-4321.';
    end if;

    if (
      select count(*) from public.appointments a
      join public.clients c on c.id = a.client_id
      where a.organization_id = org.id and c.phone = clean_phone
        and a.status in ('pending', 'confirmed') and a.starts_at > now()
    ) >= 3 then
      raise exception 'Esse telefone já tem 3 agendamentos futuros. Fale com o estabelecimento para marcar mais.';
    end if;

    if p_starts_at is null or not exists (
      select 1 from public.get_available_slots(
        org.slug, p_service_id, p_professional_id,
        (p_starts_at at time zone org.timezone)::date
      ) s
      where s.starts_at = p_starts_at
    ) then
      raise exception 'Esse horário não está mais disponível. Escolha outro.';
    end if;

    insert into public.clients (organization_id, name, phone)
    values (org.id, clean_name, clean_phone)
    on conflict (organization_id, phone) where phone is not null do nothing;

    select id into found_client_id
    from public.clients
    where organization_id = org.id and phone = clean_phone;

    insert into public.appointments (
      organization_id, professional_id, service_id, client_id, starts_at, status, source
    )
    values (org.id, p_professional_id, p_service_id, found_client_id, p_starts_at, 'pending', 'public')
    returning * into new_appointment;
  exception
    when raise_exception then
      return jsonb_build_object('ok', false, 'message', sqlerrm);
    when exclusion_violation then
      -- Duas pessoas no mesmo horário ao mesmo tempo: o banco recusa a segunda.
      return jsonb_build_object('ok', false, 'message',
        'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.');
  end;

  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object(
      'id', new_appointment.id,
      'starts_at', new_appointment.starts_at,
      'ends_at', new_appointment.ends_at,
      'service_name', new_appointment.service_name,
      'price_cents', new_appointment.price_cents,
      'status', new_appointment.status
    )
  );
end;
$$;

revoke all on function public.get_public_booking_page(text) from public;
revoke all on function public.get_available_slots(text, uuid, uuid, date) from public;
revoke all on function public.book_appointment(text, uuid, uuid, timestamptz, text, text) from public;

grant execute on function public.get_public_booking_page(text) to anon, authenticated;
grant execute on function public.get_available_slots(text, uuid, uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, uuid, timestamptz, text, text)
  to anon, authenticated;
