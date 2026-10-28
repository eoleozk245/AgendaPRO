-- Etapa 7b: o cliente cancela ou remarca pelo link. Código secreto (só o hash
-- no banco), prazo, situação, horário livre, limite de tentativas. Tudo
-- desfeito no final.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test');

-- Dias alvo no horário de São Paulo: daqui a 7 dias e daqui a 2 dias.
create temp table t as
select
  ((now() at time zone 'America/Sao_Paulo')::date + 7) as d,
  ((now() at time zone 'America/Sao_Paulo')::date + 2) as d2;
grant select on t to anon, authenticated;

create function pg_temp.at(day date, hhmm text) returns timestamptz language sql as $$
  select (day + hhmm::time) at time zone 'America/Sao_Paulo';
$$;
create function pg_temp.local_ts(hhmm text) returns timestamptz language sql as $$
  select pg_temp.at((select d from t), hhmm);
$$;
grant execute on function pg_temp.at(date, text) to anon, authenticated;
grant execute on function pg_temp.local_ts(text) to anon, authenticated;

create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
$$;
create function pg_temp.as_visitor(ip text) returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{"role":"anon"}', true),
         set_config('request.headers', json_build_object('x-forwarded-for', ip)::text, true);
$$;

-- Dono configura: Corte de 30 min, das 09:00 às 12:00 todos os dias, sem antecedência mínima.
select pg_temp.as_owner();
select public.create_organization('Barbearia Exemplo', 'barbearia-exemplo');
update public.organizations set booking_min_notice_minutes = 0, booking_max_days_ahead = 30;
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
select o.id, w, '09:00', '12:00' from public.organizations o, generate_series(0, 6) w;

reset role;
create temp table ids as
select
  (select id from public.services where name = 'Corte') as service_id,
  (select id from public.professionals limit 1) as professional_id;
grant select on ids to anon, authenticated;

-- Resultados das reservas (com o código do link), para os testes usarem.
create temp table bookings (name text primary key, result jsonb);
grant select, insert on bookings to anon, authenticated;
create function pg_temp.tok(booking text) returns text language sql as $$
  select result ->> 'manage_token' from bookings where name = booking;
$$;
grant execute on function pg_temp.tok(text) to anon, authenticated;

-- Duas reservas públicas: A daqui a 7 dias às 09:00; B daqui a 2 dias às 09:00.
select pg_temp.as_visitor('203.0.113.10');
insert into bookings
select 'a', public.book_appointment('barbearia-exemplo', service_id, professional_id,
  pg_temp.local_ts('09:00'), 'Cliente Exemplo A', '11987654321') from ids;
insert into bookings
select 'b', public.book_appointment('barbearia-exemplo', service_id, professional_id,
  pg_temp.at((select d2 from t), '09:00'), 'Cliente Exemplo B', '11987654322') from ids;

-- Código do link
select is((select result ->> 'ok' from bookings where name = 'a'), 'true', 'reserva pública dá certo');
select is(length(pg_temp.tok('a')), 43, 'reserva devolve um código de 43 caracteres');
select isnt(pg_temp.tok('a'), pg_temp.tok('b'), 'cada reserva tem um código diferente');
select is((select result -> 'changes' ->> 'enabled' from bookings where name = 'a'), 'true',
  'reserva informa que o cliente pode mudar pelo link');

reset role;
select ok(
  (select client_token_hash = sha256(convert_to(pg_temp.tok('a'), 'UTF8'))
   from public.appointments where starts_at = pg_temp.local_ts('09:00')),
  'o banco guarda só o hash do código'
);
select is(
  (select count(*)::int from public.appointments a
   where position(pg_temp.tok('a') in a::text) > 0),
  0, 'o código em si não fica em nenhuma coluna'
);

-- O que o cliente vê pelo link
select pg_temp.as_visitor('203.0.113.11');
select is(public.get_client_booking(pg_temp.tok('a')) -> 'appointment' ->> 'status', 'pending',
  'link mostra a situação do agendamento');
select is(public.get_client_booking(pg_temp.tok('a')) -> 'appointment' ->> 'professional_name',
  'Barbearia Exemplo', 'link mostra com quem é o horário');
select is(public.get_client_booking(pg_temp.tok('a')) -> 'changes' ->> 'problem', null,
  'dentro do prazo, dá para mudar');
select is(public.get_client_booking(repeat('x', 43)), null, 'código errado não mostra nada');
select is(public.get_client_booking(null), null, 'sem código não mostra nada');

-- Remarcar
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))
   where starts_at = pg_temp.local_ts('09:00')),
  0, 'o horário atual não aparece como opção'
);
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))
   where starts_at = pg_temp.local_ts('09:15')),
  1, 'horário que só encosta no próprio agendamento aparece (não conflita consigo mesmo)'
);
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('09:15')) ->> 'ok',
  'true', 'remarca para 09:15');
select is(
  (select count(*)::int
   from ids, public.get_available_slots('barbearia-exemplo', ids.service_id, ids.professional_id, (select d from t))
   where starts_at = pg_temp.local_ts('09:15')),
  0, 'o horário novo some da página pública'
);

reset role;
select pg_temp.as_owner();
insert into public.appointments (organization_id, professional_id, service_id, starts_at)
select o.id, ids.professional_id, ids.service_id, pg_temp.local_ts('11:00')
from public.organizations o, ids;
update public.appointments set status = 'confirmed' where starts_at = pg_temp.local_ts('09:15');

reset role;
select pg_temp.as_visitor('203.0.113.12');
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('11:00')) ->> 'message',
  'Esse horário não está disponível. Escolha outro.', 'não remarca para horário ocupado');
select is(public.reschedule_client_booking(repeat('x', 43), pg_temp.local_ts('10:00')) ->> 'message',
  'Link inválido. Confira o endereço que você recebeu.', 'não remarca com código errado');
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('10:00')) ->> 'ok',
  'true', 'remarca um agendamento já confirmado');
select is(public.get_client_booking(pg_temp.tok('a')) -> 'appointment' ->> 'status', 'confirmed',
  'remarcar não muda a situação (continua confirmado)');

reset role;
select is(
  (select count(*)::int from public.appointments where source = 'panel' and client_token_hash is not null),
  0, 'agendamento feito no painel não tem link de cliente'
);

-- Prazo: com 7 dias de antecedência exigida, B (daqui a 2 dias) já passou do prazo
select pg_temp.as_owner();
select lives_ok(
  $$ update public.organizations set client_change_min_notice_minutes = 10080 $$,
  'dono define o prazo para mudanças pelo link'
);
reset role;
select pg_temp.as_visitor('203.0.113.13');
select is(public.get_client_booking(pg_temp.tok('b')) -> 'changes' ->> 'problem',
  'O prazo para mudar pelo link já passou. Fale com o estabelecimento.', 'link avisa que o prazo passou');
select is(public.cancel_client_booking(pg_temp.tok('b')) ->> 'message',
  'O prazo para mudar pelo link já passou. Fale com o estabelecimento.', 'fora do prazo não cancela');

-- Estabelecimento que não aceita mudanças pelo link
reset role;
select pg_temp.as_owner();
update public.organizations set client_change_min_notice_minutes = 120, client_changes_enabled = false;
reset role;
select pg_temp.as_visitor('203.0.113.14');
select is(public.cancel_client_booking(pg_temp.tok('a')) ->> 'message',
  'Este estabelecimento não aceita mudanças pelo link. Fale com ele para cancelar ou remarcar.',
  'com mudanças desligadas, não cancela');
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))),
  0, 'com mudanças desligadas, não oferece horários'
);

-- Cancelar
reset role;
select pg_temp.as_owner();
update public.organizations set client_changes_enabled = true;
reset role;
select pg_temp.as_visitor('203.0.113.15');
select is(public.cancel_client_booking(pg_temp.tok('a')) ->> 'ok', 'true', 'cliente cancela pelo link');
select is(public.get_client_booking(pg_temp.tok('a')) -> 'appointment' ->> 'status', 'cancelled',
  'o agendamento fica cancelado');
select is(public.cancel_client_booking(pg_temp.tok('a')) ->> 'message',
  'Este agendamento já está cancelado.', 'cancelar de novo explica que já está cancelado');
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('10:30')) ->> 'message',
  'Este agendamento já está cancelado.', 'cancelado não remarca');

-- Limite de tentativas: remarcações contam igual às reservas (5 por IP em 10 min)
select pg_temp.as_visitor('198.51.100.20');
select public.reschedule_client_booking(pg_temp.tok('b'), null) from generate_series(1, 5);
select is(public.reschedule_client_booking(pg_temp.tok('b'), null) ->> 'message',
  'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'a 6ª tentativa seguida do mesmo IP é bloqueada');

select throws_ok(
  $$ select client_token_hash from public.appointments $$,
  '42501', null, 'visitante não lê a tabela de agendamentos'
);

select * from finish();
rollback;
