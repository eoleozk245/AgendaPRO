-- Etapa 7b (D-022): o cliente cancela ou remarca pelo link do agendamento.
--  * a reserva pública devolve um código secreto de 256 bits; o banco guarda
--    só o hash dele, então um vazamento do banco não entrega os links;
--  * o público continua sem tocar nas tabelas: quatro funções novas validam
--    tudo (código, prazo, situação, horário livre, limite de remarcações);
--  * o estabelecimento decide se aceita mudanças pelo link e até quando;
--  * o link deixa de valer se o cliente for excluído e 30 dias depois do horário.

-- ---------------------------------------------------------------------------
-- Regras por estabelecimento.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column client_changes_enabled boolean not null default true,
  add column client_change_min_notice_minutes integer not null default 120
    constraint organizations_client_notice_valid
      check (client_change_min_notice_minutes between 0 and 10080);

grant update (client_changes_enabled, client_change_min_notice_minutes)
  on public.organizations to authenticated;

-- Hash do código do link e quantas vezes o cliente já remarcou por ele. Só
-- reservas públicas têm código. As duas colunas ficam fora dos grants de
-- insert/update: só as funções do banco escrevem nelas.
alter table public.appointments
  add column client_token_hash bytea,
  add column client_reschedule_count integer not null default 0;
create unique index appointments_client_token_hash_idx
  on public.appointments (client_token_hash) where client_token_hash is not null;

-- ---------------------------------------------------------------------------
-- Funções internas.
-- ---------------------------------------------------------------------------

-- Código aleatório do link: 32 bytes (256 bits) do gerador forte do pgcrypto,
-- em base64 próprio para URL. 43 caracteres.
create function private.new_client_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
$$;

create function private.client_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(p_token, 'UTF8'));
$$;

-- Quantas vezes o cliente pode remarcar pelo link. Limite por agendamento:
-- quem não tem o código não consegue gastar, e quem tem não segura horários
-- trocando sem parar.
create function private.max_client_reschedules()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 3;
$$;

-- O agendamento de um código de link, se o link ainda vale: o cliente não foi
-- excluído (LGPD) e não passou de 30 dias depois do horário.
create function private.client_booking(p_token text)
returns setof public.appointments
language sql
stable
set search_path = ''
as $$
  select a.*
  from public.appointments a
  where a.client_token_hash = private.client_token_hash(p_token)
    and a.client_id is not null
    and a.ends_at > now() - interval '30 days';
$$;

-- Horários livres (antes dentro de get_available_slots).
--  * p_ignore_appointment_id deixa de fora o próprio agendamento ao remarcar:
--    mudar 15 minutos para frente não pode "conflitar" consigo mesmo;
--  * p_duration_minutes usa a duração guardada no agendamento (null = a do
--    serviço hoje). Se o dono mudar a duração do serviço depois da reserva,
--    a remarcação continua respeitando o tempo que foi reservado.
create function private.free_slots(
  p_organization_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date,
  p_ignore_appointment_id uuid,
  p_duration_minutes integer
)
returns table (starts_at timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  org public.organizations;
  svc public.services;
  duration integer;
  local_today date;
begin
  select * into org from public.organizations where id = p_organization_id;
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
  duration := coalesce(p_duration_minutes, svc.duration_minutes);

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
      (extract(epoch from (bh.closes_at - bh.opens_at)) / 60)::integer - duration,
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
        and a.id is distinct from p_ignore_appointment_id
        and tstzrange(a.starts_at, a.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_start + make_interval(mins => duration), '[)')
    )
    and not exists (
      select 1 from public.availability_blocks b
      where b.professional_id = p_professional_id
        and tstzrange(b.starts_at, b.ends_at, '[)')
            && tstzrange(c.slot_start, c.slot_start + make_interval(mins => duration), '[)')
    )
  order by c.slot_start;
end;
$$;

-- Limite de tentativas da reserva (D-016). Devolve a mensagem de recusa, ou
-- null depois de registrar a tentativa.
create function private.register_booking_attempt(p_organization_id uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  caller_ip text := private.request_ip();
begin
  -- Guarda só as últimas 24 horas de tentativas.
  delete from private.booking_attempts where created_at < now() - interval '1 day';

  if caller_ip is not null and (
    select count(*) from private.booking_attempts
    where ip = caller_ip and created_at > now() - interval '10 minutes'
  ) >= 5 then
    return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  end if;
  if (
    select count(*) from private.booking_attempts
    where organization_id = p_organization_id and created_at > now() - interval '1 minute'
  ) >= 30 then
    return 'Muitas reservas ao mesmo tempo. Tente de novo em instantes.';
  end if;

  insert into private.booking_attempts (organization_id, ip) values (p_organization_id, caller_ip);
  return null;
end;
$$;

-- Por que o cliente não pode mudar este agendamento pelo link (ou null se pode).
create function private.client_change_problem(a public.appointments, o public.organizations)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when a.status = 'cancelled' then 'Este agendamento já está cancelado.'
    when a.status not in ('pending', 'confirmed') then 'Este agendamento já foi encerrado.'
    when now() >= a.starts_at then 'Este horário já passou.'
    when not o.client_changes_enabled then
      'Este estabelecimento não aceita mudanças pelo link. Fale com ele para cancelar ou remarcar.'
    when now() > a.starts_at - make_interval(mins => o.client_change_min_notice_minutes) then
      'O prazo para mudar pelo link já passou. Fale com o estabelecimento.'
  end;
$$;

-- Dá para remarcar? Além das regras gerais: ainda há remarcações no limite e o
-- profissional (ativo) ainda faz o serviço (ativo). Se não, só cancelar.
create function private.client_can_reschedule(a public.appointments, o public.organizations)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.client_change_problem(a, o) is null
    and a.client_reschedule_count < private.max_client_reschedules()
    and exists (
      select 1
      from public.professional_services ps
      join public.professionals p on p.id = ps.professional_id and p.active
      join public.services s on s.id = ps.service_id and s.active
      where ps.professional_id = a.professional_id and ps.service_id = a.service_id
    );
$$;

revoke all on function private.new_client_token() from public;
revoke all on function private.client_token_hash(text) from public;
revoke all on function private.max_client_reschedules() from public;
revoke all on function private.client_booking(text) from public;
revoke all on function private.free_slots(uuid, uuid, uuid, date, uuid, integer) from public;
revoke all on function private.register_booking_attempt(uuid) from public;
revoke all on function private.client_change_problem(public.appointments, public.organizations) from public;
revoke all on function private.client_can_reschedule(public.appointments, public.organizations) from public;

-- ---------------------------------------------------------------------------
-- Funções públicas que já existiam: mesmo comportamento, agora usando as
-- funções internas. book_appointment passa a devolver o código do link.
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date
)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.starts_at
  from public.organizations o
  cross join lateral private.free_slots(o.id, p_service_id, p_professional_id, p_date, null, null) f
  where o.slug = lower(btrim(p_slug))
  order by f.starts_at;
$$;

create or replace function public.book_appointment(
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
  clean_name text := btrim(coalesce(p_client_name, ''));
  clean_phone text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  refusal text;
  found_client_id uuid;
  new_appointment public.appointments;
  token text := private.new_client_token();
begin
  select * into org from public.organizations where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Estabelecimento não encontrado.');
  end if;

  -- Limites contra abuso (D-016). A tentativa fica registrada mesmo se falhar.
  refusal := private.register_booking_attempt(org.id);
  if refusal is not null then
    return jsonb_build_object('ok', false, 'message', refusal);
  end if;

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
      select 1 from private.free_slots(
        org.id, p_service_id, p_professional_id,
        (p_starts_at at time zone org.timezone)::date, null, null
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
      organization_id, professional_id, service_id, client_id, starts_at, status, source,
      client_token_hash
    )
    values (
      org.id, p_professional_id, p_service_id, found_client_id, p_starts_at, 'pending', 'public',
      private.client_token_hash(token)
    )
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
    ),
    -- Mostrado uma vez só, na tela de confirmação. O banco não guarda o código.
    'manage_token', token,
    'changes', jsonb_build_object(
      'enabled', org.client_changes_enabled,
      'deadline', new_appointment.starts_at - make_interval(mins => org.client_change_min_notice_minutes)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções novas do link do cliente.
-- ---------------------------------------------------------------------------

-- O que o cliente vê pelo link. Só o necessário: nada de telefone nem de dados
-- de outros clientes. null quando o link não existe ou não vale mais.
create function public.get_client_booking(p_token text)
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
      'max_days_ahead', o.booking_max_days_ahead
    ),
    'appointment', jsonb_build_object(
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'status', a.status,
      'service_name', a.service_name,
      'duration_minutes', a.duration_minutes,
      'price_cents', a.price_cents,
      'professional_name', p.name
    ),
    'changes', jsonb_build_object(
      'enabled', o.client_changes_enabled,
      'deadline', a.starts_at - make_interval(mins => o.client_change_min_notice_minutes),
      'problem', private.client_change_problem(a, o),
      'can_reschedule', private.client_can_reschedule(a, o),
      'reschedules_left', greatest(0, private.max_client_reschedules() - a.client_reschedule_count)
    )
  )
  from private.client_booking(p_token) a
  join public.organizations o on o.id = a.organization_id
  join public.professionals p on p.id = a.professional_id;
$$;

-- Horários para remarcar: mesmo serviço, profissional e duração, ignorando o
-- próprio agendamento e sem repetir o horário atual. Vazio se não dá para remarcar.
create function public.get_client_reschedule_slots(p_token text, p_date date)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.starts_at
  from private.client_booking(p_token) a
  join public.organizations o on o.id = a.organization_id
  cross join lateral private.free_slots(
    o.id, a.service_id, a.professional_id, p_date, a.id, a.duration_minutes
  ) f
  where private.client_can_reschedule(a, o)
    and f.starts_at <> a.starts_at
  order by f.starts_at;
$$;

create function public.cancel_client_booking(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  appointment public.appointments;
  org public.organizations;
  problem text;
begin
  select a.* into appointment
  from public.appointments a
  where a.id = (select b.id from private.client_booking(p_token) b)
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Link inválido. Confira o endereço que você recebeu.');
  end if;

  select * into org from public.organizations where id = appointment.organization_id;
  problem := private.client_change_problem(appointment, org);
  if problem is not null then
    return jsonb_build_object('ok', false, 'message', problem);
  end if;

  update public.appointments set status = 'cancelled' where id = appointment.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Remarcar: mesmas regras da reserva (horário livre de verdade, antecedência,
-- dias à frente) e no máximo private.max_client_reschedules() vezes. A situação
-- não muda: um agendamento confirmado continua confirmado no horário novo.
create function public.reschedule_client_booking(p_token text, p_starts_at timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  appointment public.appointments;
  org public.organizations;
  refusal text;
  updated public.appointments;
begin
  select a.* into appointment
  from public.appointments a
  where a.id = (select b.id from private.client_booking(p_token) b)
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Link inválido. Confira o endereço que você recebeu.');
  end if;

  select * into org from public.organizations where id = appointment.organization_id;
  refusal := private.client_change_problem(appointment, org);
  if refusal is null and appointment.client_reschedule_count >= private.max_client_reschedules() then
    refusal := format(
      'Você já remarcou %s vezes pelo link. Para mudar de novo, fale com o estabelecimento.',
      private.max_client_reschedules()
    );
  end if;
  if refusal is not null then
    return jsonb_build_object('ok', false, 'message', refusal);
  end if;

  begin
    if p_starts_at is null or p_starts_at = appointment.starts_at or not exists (
      select 1 from private.free_slots(
        org.id, appointment.service_id, appointment.professional_id,
        (p_starts_at at time zone org.timezone)::date, appointment.id, appointment.duration_minutes
      ) s
      where s.starts_at = p_starts_at
    ) then
      raise exception 'Esse horário não está disponível. Escolha outro.';
    end if;

    update public.appointments
    set starts_at = p_starts_at,
        client_reschedule_count = client_reschedule_count + 1
    where id = appointment.id
    returning * into updated;
  exception
    when raise_exception then
      return jsonb_build_object('ok', false, 'message', sqlerrm);
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'message',
        'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.');
  end;

  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object(
      'starts_at', updated.starts_at,
      'ends_at', updated.ends_at,
      'status', updated.status
    )
  );
end;
$$;

revoke all on function public.get_client_booking(text) from public;
revoke all on function public.get_client_reschedule_slots(text, date) from public;
revoke all on function public.cancel_client_booking(text) from public;
revoke all on function public.reschedule_client_booking(text, timestamptz) from public;

grant execute on function public.get_client_booking(text) to anon, authenticated;
grant execute on function public.get_client_reschedule_slots(text, date) to anon, authenticated;
grant execute on function public.cancel_client_booking(text) to anon, authenticated;
grant execute on function public.reschedule_client_booking(text, timestamptz) to anon, authenticated;
