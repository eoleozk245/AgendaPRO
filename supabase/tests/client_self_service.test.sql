-- Etapa 7b: o cliente cancela ou remarca pelo link. Código secreto (só o hash
-- no banco), prazo, situação, horário livre, duração guardada, limite de
-- remarcações, validade do link e permissões. Tudo desfeito no final.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(54);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test');

-- Dias alvo no horário de São Paulo.
create temp table t as
select
  ((now() at time zone 'America/Sao_Paulo')::date + 7) as d,
  ((now() at time zone 'America/Sao_Paulo')::date + 2) as d2,
  ((now() at time zone 'America/Sao_Paulo')::date + 10) as d3,
  ((now() at time zone 'America/Sao_Paulo')::date + 12) as d4;
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

-- Dono configura: Corte (30 min) e Barba (60 min), das 09:00 às 12:00 todos os
-- dias, sem antecedência mínima para reservar.
select pg_temp.as_owner();
select public.create_organization('Barbearia Exemplo', 'barbearia-exemplo');
update public.organizations set booking_min_notice_minutes = 0, booking_max_days_ahead = 30;
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Barba', 60, 3000 from public.organizations;
insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
select o.id, w, '09:00', '12:00' from public.organizations o, generate_series(0, 6) w;

reset role;
create temp table ids as
select
  (select id from public.services where name = 'Corte') as service_id,
  (select id from public.services where name = 'Barba') as barba_id,
  (select id from public.professionals limit 1) as professional_id;
grant select on ids to anon, authenticated;

-- Resultados das reservas (com o código do link), para os testes usarem.
create temp table bookings (name text primary key, result jsonb);
grant select, insert on bookings to anon, authenticated;
create function pg_temp.tok(booking text) returns text language sql as $$
  select result ->> 'manage_token' from bookings where name = booking;
$$;
grant execute on function pg_temp.tok(text) to anon, authenticated;
create function pg_temp.view(booking text) returns jsonb language sql as $$
  select public.get_client_booking(pg_temp.tok(booking));
$$;
grant execute on function pg_temp.view(text) to anon, authenticated;

-- Reservas públicas (IPs diferentes para não esbarrar no limite da reserva):
--  A: Corte daqui a 7 dias às 09:00;  B: Corte daqui a 2 dias às 09:00;
--  C: Corte daqui a 10 dias às 09:00; D: Barba daqui a 12 dias às 09:00.
select pg_temp.as_visitor('203.0.113.10');
insert into bookings select 'a', public.book_appointment('barbearia-exemplo', service_id, professional_id,
  pg_temp.local_ts('09:00'), 'Cliente Exemplo A', '11987654321') from ids;
select pg_temp.as_visitor('203.0.113.11');
insert into bookings select 'b', public.book_appointment('barbearia-exemplo', service_id, professional_id,
  pg_temp.at((select d2 from t), '09:00'), 'Cliente Exemplo B', '11987654322') from ids;
select pg_temp.as_visitor('203.0.113.12');
insert into bookings select 'c', public.book_appointment('barbearia-exemplo', service_id, professional_id,
  pg_temp.at((select d3 from t), '09:00'), 'Cliente Exemplo C', '11987654323') from ids;
select pg_temp.as_visitor('203.0.113.13');
insert into bookings select 'd', public.book_appointment('barbearia-exemplo', barba_id, professional_id,
  pg_temp.at((select d4 from t), '09:00'), 'Cliente Exemplo D', '11987654324') from ids;

-- ---------------------------------------------------------------------------
-- Código do link
-- ---------------------------------------------------------------------------
select is((select result ->> 'ok' from bookings where name = 'a'), 'true', 'reserva pública dá certo');
select is(length(pg_temp.tok('a')), 43, 'reserva devolve um código de 43 caracteres (256 bits)');
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
  (select count(*)::int from public.appointments a where position(pg_temp.tok('a') in a::text) > 0),
  0, 'o código em si não fica em nenhuma coluna'
);

-- ---------------------------------------------------------------------------
-- O que o cliente vê pelo link
-- ---------------------------------------------------------------------------
select pg_temp.as_visitor('198.51.100.1');
select is(pg_temp.view('a') -> 'appointment' ->> 'status', 'pending', 'link mostra a situação');
select is(pg_temp.view('a') -> 'appointment' ->> 'professional_name', 'Barbearia Exemplo',
  'link mostra com quem é o horário');
select is(pg_temp.view('a') -> 'changes' ->> 'problem', null, 'dentro do prazo, dá para mudar');
select is(pg_temp.view('a') -> 'changes' ->> 'reschedules_left', '3', 'começa com 3 remarcações');
select is(pg_temp.view('a') -> 'changes' ->> 'can_reschedule', 'true', 'dá para remarcar');
select is(public.get_client_booking(repeat('x', 43)), null, 'código errado não mostra nada');
select is(public.get_client_booking(null), null, 'sem código não mostra nada');

-- ---------------------------------------------------------------------------
-- Remarcar
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))
   where starts_at = pg_temp.local_ts('09:00')),
  0, 'o horário atual não aparece como opção'
);
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))
   where starts_at = pg_temp.local_ts('09:15')),
  1, 'horário sobreposto ao próprio agendamento aparece (não conflita consigo mesmo)'
);
select ok(
  (select array_agg(starts_at) = array_agg(starts_at order by starts_at)
   from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))),
  'horários em ordem'
);
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('09:00')) ->> 'message',
  'Esse horário não está disponível. Escolha outro.', 'remarcar para o mesmo horário é recusado');
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
update public.services set price_cents = 9999 where name = 'Corte';

reset role;
select pg_temp.as_visitor('198.51.100.2');
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('11:00')) ->> 'message',
  'Esse horário não está disponível. Escolha outro.', 'não remarca para horário ocupado');
select is(public.reschedule_client_booking(repeat('x', 43), pg_temp.local_ts('10:00')) ->> 'message',
  'Link inválido. Confira o endereço que você recebeu.', 'não remarca com código errado');
select is(public.reschedule_client_booking(pg_temp.tok('a'), pg_temp.local_ts('10:00')) ->> 'ok',
  'true', 'remarca um agendamento já confirmado');
select is(pg_temp.view('a') -> 'appointment' ->> 'status', 'confirmed',
  'remarcar não muda a situação (continua confirmado)');
select is(pg_temp.view('a') -> 'appointment' ->> 'price_cents', '4500',
  'remarcar mantém o preço da reserva');
select is(pg_temp.view('a') -> 'changes' ->> 'reschedules_left', '1', 'cada remarcação conta');

reset role;
select is(
  (select count(*)::int from public.appointments where source = 'panel' and client_token_hash is not null),
  0, 'agendamento feito no painel não tem link de cliente'
);

-- ---------------------------------------------------------------------------
-- Duração guardada: Barba reservada com 60 min; depois o dono muda para 30
-- ---------------------------------------------------------------------------
select pg_temp.as_owner();
update public.services set duration_minutes = 30 where name = 'Barba';
reset role;
select pg_temp.as_visitor('198.51.100.3');
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('d'), (select d4 from t))
   where starts_at = pg_temp.at((select d4 from t), '11:30')),
  0, '11:30 não aparece: 60 minutos não cabem antes do fechamento'
);
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('d'), (select d4 from t))
   where starts_at = pg_temp.at((select d4 from t), '11:00')),
  1, '11:00 aparece (60 minutos cabem até 12:00)'
);
select is(
  public.reschedule_client_booking(pg_temp.tok('d'), pg_temp.at((select d4 from t), '11:30')) ->> 'ok',
  'false', 'remarcar para 11:30 é recusado'
);

-- ---------------------------------------------------------------------------
-- Limite de remarcações por agendamento (C)
-- ---------------------------------------------------------------------------
select public.reschedule_client_booking(pg_temp.tok('c'), pg_temp.at((select d3 from t), '09:30'));
select public.reschedule_client_booking(pg_temp.tok('c'), pg_temp.at((select d3 from t), '10:00'));
select is(
  public.reschedule_client_booking(pg_temp.tok('c'), pg_temp.at((select d3 from t), '10:30')) ->> 'ok',
  'true', 'a 3ª remarcação passa'
);
select is(
  public.reschedule_client_booking(pg_temp.tok('c'), pg_temp.at((select d3 from t), '11:00')) ->> 'message',
  'Você já remarcou 3 vezes pelo link. Para mudar de novo, fale com o estabelecimento.',
  'a 4ª remarcação é recusada'
);
select is(pg_temp.view('c') -> 'changes' ->> 'can_reschedule', 'false', 'sem remarcações, o link avisa');
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('c'), (select d3 from t))),
  0, 'sem remarcações, não oferece horários'
);
select is(public.cancel_client_booking(pg_temp.tok('c')) ->> 'ok', 'true',
  'sem remarcações, ainda dá para cancelar');
reset role;
select ok(
  (select cancelled_at is not null from public.appointments
   where starts_at = pg_temp.at((select d3 from t), '10:30')),
  'cancelamento registra a data'
);
select pg_temp.as_visitor('198.51.100.4');
select is(public.cancel_client_booking(pg_temp.tok('c')) ->> 'message',
  'Este agendamento já está cancelado.', 'cancelar de novo explica que já está cancelado');
select is(public.reschedule_client_booking(pg_temp.tok('c'), pg_temp.at((select d3 from t), '09:00')) ->> 'message',
  'Este agendamento já está cancelado.', 'cancelado não remarca');

-- ---------------------------------------------------------------------------
-- Prazo: com 7 dias de antecedência exigida, B (daqui a 2 dias) já passou
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.as_owner();
select lives_ok(
  $$ update public.organizations set client_change_min_notice_minutes = 10080 $$,
  'dono define o prazo para mudanças pelo link'
);
reset role;
select pg_temp.as_visitor('198.51.100.5');
select is(pg_temp.view('b') -> 'changes' ->> 'problem',
  'O prazo para mudar pelo link já passou. Fale com o estabelecimento.', 'link avisa que o prazo passou');
select is(public.cancel_client_booking(pg_temp.tok('b')) ->> 'message',
  'O prazo para mudar pelo link já passou. Fale com o estabelecimento.', 'fora do prazo não cancela');
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('b'), (select d2 from t))),
  0, 'fora do prazo não oferece horários'
);
select is(
  public.reschedule_client_booking(pg_temp.tok('b'), pg_temp.at((select d2 from t), '10:00')) ->> 'message',
  'O prazo para mudar pelo link já passou. Fale com o estabelecimento.', 'fora do prazo não remarca'
);

-- ---------------------------------------------------------------------------
-- Estabelecimento que não aceita mudanças pelo link
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.as_owner();
update public.organizations set client_change_min_notice_minutes = 120, client_changes_enabled = false;
reset role;
select pg_temp.as_visitor('198.51.100.6');
select is(public.cancel_client_booking(pg_temp.tok('a')) ->> 'message',
  'Este estabelecimento não aceita mudanças pelo link. Fale com ele para cancelar ou remarcar.',
  'com mudanças desligadas, não cancela');
select is(
  (select count(*)::int from public.get_client_reschedule_slots(pg_temp.tok('a'), (select d from t))),
  0, 'com mudanças desligadas, não oferece horários'
);

-- ---------------------------------------------------------------------------
-- Encerrado: o dono confirma e conclui B
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.as_owner();
update public.organizations set client_changes_enabled = true;
update public.appointments set status = 'confirmed' where starts_at = pg_temp.at((select d2 from t), '09:00');
update public.appointments set status = 'completed' where starts_at = pg_temp.at((select d2 from t), '09:00');
reset role;
select pg_temp.as_visitor('198.51.100.7');
select is(pg_temp.view('b') -> 'changes' ->> 'problem', 'Este agendamento já foi encerrado.',
  'concluído não muda mais');

-- ---------------------------------------------------------------------------
-- Validade do link
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.appointments (
  organization_id, professional_id, service_id, client_id, starts_at, client_token_hash
)
select o.id, ids.professional_id, ids.service_id,
  (select id from public.clients where name = 'Cliente Exemplo B'),
  now() - interval '1 day', sha256(convert_to('codigo-de-ontem-exemplo-0123456789', 'UTF8'))
from public.organizations o, ids;
insert into public.appointments (
  organization_id, professional_id, service_id, client_id, starts_at, client_token_hash
)
select o.id, ids.professional_id, ids.service_id,
  (select id from public.clients where name = 'Cliente Exemplo B'),
  now() - interval '40 days', sha256(convert_to('codigo-antigo-exemplo-0123456789ab', 'UTF8'))
from public.organizations o, ids;

select pg_temp.as_visitor('198.51.100.8');
select is(
  public.get_client_booking('codigo-de-ontem-exemplo-0123456789') -> 'changes' ->> 'problem',
  'Este horário já passou.', 'horário que já passou é explicado assim'
);
select is(public.get_client_booking('codigo-antigo-exemplo-0123456789ab'), null,
  '30 dias depois do horário, o link deixa de valer');

reset role;
select pg_temp.as_owner();
delete from public.clients where name = 'Cliente Exemplo A';
reset role;
select pg_temp.as_visitor('198.51.100.9');
select is(pg_temp.view('a'), null, 'cliente excluído (LGPD): o link deixa de valer');

-- ---------------------------------------------------------------------------
-- Profissional desativado depois da reserva (D): só cancelar
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.as_owner();
update public.professionals set active = false;
reset role;
select pg_temp.as_visitor('198.51.100.10');
select is(pg_temp.view('d') -> 'changes' ->> 'can_reschedule', 'false',
  'com o profissional desativado, o link não oferece remarcar');
select is(
  public.reschedule_client_booking(pg_temp.tok('d'), pg_temp.at((select d4 from t), '10:00')) ->> 'ok',
  'false', 'com o profissional desativado, remarcar é recusado'
);
select is(public.cancel_client_booking(pg_temp.tok('d')) ->> 'ok', 'true',
  'com o profissional desativado, cancelar funciona');

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
select throws_ok($$ select client_token_hash from public.appointments $$, '42501', null,
  'visitante não lê a tabela de agendamentos');
select throws_ok(
  $$ select * from private.free_slots(null, null, null, null, null, null) $$, '42501', null,
  'visitante não chama as funções internas'
);
reset role;
select pg_temp.as_owner();
select throws_ok(
  $$ update public.appointments set client_token_hash = null, client_reschedule_count = 0 $$,
  '42501', null, 'nem o dono altera o código ou o contador pela API'
);

select * from finish();
rollback;
