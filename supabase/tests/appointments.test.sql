-- Etapa 4: conflitos, estados, cópia de preço/duração, bloqueios e isolamento.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@exemplo.test');

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Barbearia Exemplo A', 'barbearia-a');
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.clients (organization_id, name, phone)
select id, 'Cliente Exemplo', '11999990000' from public.organizations;

-- Atalho para criar agendamento como o dono A.
create function pg_temp.book(starts text, price integer default null) returns uuid language sql as $$
  insert into public.appointments (organization_id, professional_id, service_id, client_id, starts_at)
  select o.id, p.id, s.id, c.id, starts::timestamptz
  from public.organizations o
  join public.professionals p on p.organization_id = o.id
  join public.services s on s.organization_id = o.id
  join public.clients c on c.organization_id = o.id
  returning id;
$$;

-- Cópia de preço e duração
select lives_ok($$ select pg_temp.book('2030-01-07 10:00-03') $$, 'dono cria agendamento');
select results_eq(
  $$ select price_cents, duration_minutes, service_name, ends_at
     from public.appointments where starts_at = '2030-01-07 10:00-03' $$,
  $$ values (4500, 30, 'Corte'::text, '2030-01-07 10:30-03'::timestamptz) $$,
  'preço, duração e nome são copiados do serviço e o fim é calculado'
);
select throws_ok(
  $$ insert into public.appointments (organization_id, professional_id, service_id, starts_at, price_cents)
     select o.id, p.id, s.id, '2030-01-07 15:00-03', 1
     from public.organizations o join public.professionals p on p.organization_id = o.id
     join public.services s on s.organization_id = o.id $$,
  '42501', null,
  'cliente da API não consegue enviar o preço'
);

update public.services set price_cents = 9900, name = 'Corte Premium';
select results_eq(
  $$ select price_cents, service_name from public.appointments where starts_at = '2030-01-07 10:00-03' $$,
  $$ values (4500, 'Corte'::text) $$,
  'mudar o serviço depois não altera o agendamento já feito'
);

-- Conflitos
select throws_ok($$ select pg_temp.book('2030-01-07 10:15-03') $$, '23P01', null,
  'sobreposição parcial é recusada');
select throws_ok($$ select pg_temp.book('2030-01-07 09:45-03') $$, '23P01', null,
  'sobreposição no começo é recusada');
select lives_ok($$ select pg_temp.book('2030-01-07 10:30-03') $$,
  'horário encostado no fim (10:30) é aceito');
select lives_ok($$ select pg_temp.book('2030-01-07 09:30-03') $$,
  'horário encostado no começo (09:30-10:00) é aceito');

-- Estados
create temp table ids as select id from public.appointments where starts_at = '2030-01-07 10:00-03';
grant select on ids to authenticated;

select throws_ok($$ update public.appointments set status = 'pending' where id = (select id from ids) $$,
  'P0001', null, 'confirmado não volta para pendente');
insert into public.appointments (organization_id, professional_id, service_id, starts_at, status)
select o.id, p.id, s.id, '2030-01-07 14:00-03', 'pending'
from public.organizations o join public.professionals p on p.organization_id = o.id
join public.services s on s.organization_id = o.id;
select lives_ok($$ update public.appointments set status = 'confirmed' where starts_at = '2030-01-07 14:00-03' $$,
  'pendente pode ser confirmado');
select lives_ok($$ update public.appointments set status = 'completed' where id = (select id from ids) $$,
  'confirmado pode ser concluído');
select throws_ok($$ update public.appointments set status = 'cancelled' where id = (select id from ids) $$,
  'P0001', null, 'concluído não pode ser cancelado');
select throws_ok($$ update public.appointments set starts_at = '2030-01-08 10:00-03' where id = (select id from ids) $$,
  'P0001', null, 'agendamento encerrado não muda de horário');

select lives_ok($$ select pg_temp.book('2030-01-08 10:00-03') $$, 'novo agendamento em outro dia');
select lives_ok(
  $$ update public.appointments set status = 'cancelled' where starts_at = '2030-01-08 10:00-03' $$,
  'confirmado pode ser cancelado');
select results_eq(
  $$ select cancelled_at is not null from public.appointments where starts_at = '2030-01-08 10:00-03' $$,
  $$ values (true) $$, 'cancelamento registra a data');
select lives_ok($$ select pg_temp.book('2030-01-08 10:00-03') $$,
  'horário cancelado fica livre para outro agendamento');
select throws_ok(
  $$ insert into public.appointments (organization_id, professional_id, service_id, starts_at, status)
     select o.id, p.id, s.id, '2030-01-09 10:00-03', 'completed'
     from public.organizations o join public.professionals p on p.organization_id = o.id
     join public.services s on s.organization_id = o.id $$,
  'P0001', null, 'agendamento novo não nasce concluído');
select throws_ok($$ delete from public.appointments $$, '42501', null,
  'agendamento não é apagado, só cancelado');

-- Bloqueios
insert into public.availability_blocks (organization_id, professional_id, starts_at, ends_at, reason)
select o.id, p.id, '2030-01-10 12:00-03', '2030-01-10 13:00-03', 'Almoço'
from public.organizations o join public.professionals p on p.organization_id = o.id;

select throws_ok($$ select pg_temp.book('2030-01-10 12:30-03') $$, '23P01', null,
  'agendamento em cima de bloqueio é recusado');
select lives_ok($$ select pg_temp.book('2030-01-10 13:00-03') $$, 'agendamento logo após o bloqueio é aceito');
select throws_ok(
  $$ insert into public.availability_blocks (organization_id, professional_id, starts_at, ends_at)
     select o.id, p.id, '2030-01-10 13:15-03', '2030-01-10 14:00-03'
     from public.organizations o join public.professionals p on p.organization_id = o.id $$,
  '23P01', null, 'bloqueio em cima de agendamento é recusado');

-- LGPD: apagar o cliente mantém o histórico sem o dado pessoal
delete from public.clients;
select results_eq(
  $$ select count(*)::int from public.appointments where client_id is null $$,
  $$ select count(*)::int from public.appointments $$,
  'apagar o cliente mantém os agendamentos sem vínculo pessoal');

-- Isolamento
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.create_organization('Salão Exemplo B', 'salao-b');
select results_eq($$ select count(*)::int from public.appointments $$, $$ values (0) $$,
  'B não vê agendamentos de A');
select results_eq($$ select count(*)::int from public.availability_blocks $$, $$ values (0) $$,
  'B não vê bloqueios de A');
select is_empty(
  $$ update public.appointments set status = 'cancelled' returning id $$,
  'B não cancela agendamentos de A');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.appointments $$, '42501', null, 'anon não lê agendamentos');

select * from finish();
rollback;
