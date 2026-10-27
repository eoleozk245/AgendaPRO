-- Etapa 5: página pública. Horários livres, reserva, validações e limite de tentativas.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test');

-- Data alvo: daqui a 7 dias no horário de São Paulo.
create temp table t as
select ((now() at time zone 'America/Sao_Paulo')::date + 7) as d;
grant select on t to anon, authenticated;

create function pg_temp.local_ts(hhmm text) returns timestamptz language sql as $$
  select ((select d from t) + hhmm::time) at time zone 'America/Sao_Paulo';
$$;
grant execute on function pg_temp.local_ts(text) to anon, authenticated;

-- Dono configura o estabelecimento
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.create_organization('Barbearia Exemplo', 'barbearia-exemplo');
update public.organizations set booking_min_notice_minutes = 0, booking_max_days_ahead = 30;
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.services (organization_id, name, duration_minutes, price_cents, active)
select id, 'Serviço Inativo', 30, 1000, false from public.organizations;
insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
select id, extract(dow from (select d from t)), '09:00', '11:00' from public.organizations;

reset role;
create temp table ids as
select
  (select id from public.services where name = 'Corte') as service_id,
  (select id from public.services where name = 'Serviço Inativo') as inactive_service_id,
  (select id from public.professionals limit 1) as professional_id;
grant select on ids to anon, authenticated;

-- Visitante sem login
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
set local request.headers = '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}';

select is(
  (select public.get_public_booking_page('barbearia-exemplo') -> 'organization' ->> 'name'),
  'Barbearia Exemplo', 'anon vê os dados públicos do estabelecimento'
);
select is(
  (select jsonb_array_length(public.get_public_booking_page('barbearia-exemplo') -> 'services')),
  1, 'só serviços ativos aparecem'
);
select is(public.get_public_booking_page('nao-existe'), null, 'slug desconhecido não retorna nada');

select results_eq(
  $$ select to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI')
     from public.get_available_slots('barbearia-exemplo', (select service_id from ids), (select professional_id from ids), (select d from t)) $$,
  $$ values ('09:00'), ('09:15'), ('09:30'), ('09:45'), ('10:00'), ('10:15'), ('10:30') $$,
  'horários de 15 em 15 min, cabendo o serviço inteiro antes do fechamento'
);

-- Dono agenda 09:30 e bloqueia 10:15-10:30
reset role;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.appointments (organization_id, professional_id, service_id, starts_at)
select o.id, (select professional_id from ids), (select service_id from ids), pg_temp.local_ts('09:30')
from public.organizations o;
insert into public.availability_blocks (organization_id, professional_id, starts_at, ends_at)
select o.id, (select professional_id from ids), pg_temp.local_ts('10:15'), pg_temp.local_ts('10:30')
from public.organizations o;

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select results_eq(
  $$ select to_char(starts_at at time zone 'America/Sao_Paulo', 'HH24:MI')
     from public.get_available_slots('barbearia-exemplo', (select service_id from ids), (select professional_id from ids), (select d from t)) $$,
  $$ values ('09:00'), ('10:30') $$,
  'agendamentos e bloqueios tiram os horários que conflitam'
);
select is_empty(
  $$ select * from public.get_available_slots('barbearia-exemplo', (select inactive_service_id from ids), (select professional_id from ids), (select d from t)) $$,
  'serviço inativo não tem horários'
);
select is_empty(
  $$ select * from public.get_available_slots('barbearia-exemplo', (select service_id from ids), (select professional_id from ids), (select d from t) + 30) $$,
  'além do limite de dias não há horários'
);
select is_empty(
  $$ select * from public.get_available_slots('barbearia-exemplo', (select service_id from ids), (select professional_id from ids), (select d from t) - 14) $$,
  'data no passado não tem horários'
);

-- Reserva (tentativas 1 a 5 do mesmo IP)
select is(
  (select public.book_appointment('barbearia-exemplo', (select service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('09:00'), '  Cliente Exemplo  ', '(11) 98765-4321') ->> 'ok'),
  'true', 'visitante reserva um horário livre'
);
select is(
  (select public.book_appointment('barbearia-exemplo', (select service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('09:00'), 'Outra Pessoa', '11911112222') ->> 'message'),
  'Esse horário não está mais disponível. Escolha outro.', 'o mesmo horário não pode ser reservado duas vezes'
);
select is(
  (select public.book_appointment('barbearia-exemplo', (select service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('10:30'), 'Cliente Exemplo', '1234') ->> 'message'),
  'Informe um telefone com DDD, por exemplo (11) 98765-4321.', 'telefone inválido é recusado'
);
select is(
  (select public.book_appointment('barbearia-exemplo', (select service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('10:35'), 'Cliente Exemplo', '11987654321') ->> 'ok'),
  'false', 'horário fora da grade de 15 min é recusado'
);
select is(
  (select public.book_appointment('barbearia-exemplo', (select inactive_service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('10:30'), 'Cliente Exemplo', '11987654321') ->> 'ok'),
  'false', 'serviço inativo não pode ser reservado'
);
select is(
  (select public.book_appointment('barbearia-exemplo', (select service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('10:30'), 'Cliente Exemplo', '11987654321') ->> 'message'),
  'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'a 6ª tentativa em 10 minutos do mesmo IP é bloqueada (falhas também contam)'
);

-- Outro IP consegue
set local request.headers = '{"x-forwarded-for": "198.51.100.20"}';
select is(
  (select public.book_appointment('barbearia-exemplo', (select service_id from ids), (select professional_id from ids),
     pg_temp.local_ts('10:30'), 'Cliente Exemplo', '11987654321') ->> 'ok'),
  'true', 'outro IP reserva normalmente'
);

-- Visitante não lê tabelas internas
select throws_ok($$ select * from public.appointments $$, '42501', null, 'anon não lê agendamentos');
select throws_ok($$ select * from private.booking_attempts $$, '42501', null, 'anon não lê o registro de tentativas');

-- Conferência como dono
reset role;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$ select status, source, price_cents from public.appointments where starts_at = pg_temp.local_ts('09:00') $$,
  $$ values ('pending'::text, 'public'::text, 4500) $$,
  'reserva pública nasce pendente, com origem e preço copiado'
);
select results_eq(
  $$ select name, phone from public.clients $$,
  $$ values ('Cliente Exemplo'::text, '11987654321'::text) $$,
  'cliente criado uma vez, com nome limpo e telefone só com dígitos (reaproveitado na 2ª reserva)'
);
reset role;
select is(
  (select count(*)::int from private.booking_attempts),
  6, 'tentativas registradas, inclusive as que falharam'
);

select * from finish();
rollback;
