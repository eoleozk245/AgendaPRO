-- Etapa 3: serviços, profissionais, horários e clientes.
-- Isolamento entre estabelecimentos, validações do banco e ligação automática
-- entre profissionais e serviços. Tudo desfeito no final (rollback).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@exemplo.test');

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Estabelecimento A com um serviço, horário e cliente
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Barbearia Exemplo A', 'barbearia-a');

select results_eq(
  $$ select name from public.professionals $$,
  $$ values ('Barbearia Exemplo A') $$,
  'criar o estabelecimento cria o primeiro profissional'
);

insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte de cabelo', 30, 4500 from public.organizations;

select results_eq(
  $$ select count(*)::int from public.professional_services $$,
  $$ values (1) $$,
  'serviço novo é ligado ao profissional automaticamente'
);

insert into public.professionals (organization_id, name)
select id, 'Profissional Exemplo 2' from public.organizations;

select results_eq(
  $$ select count(*)::int from public.professional_services $$,
  $$ values (2) $$,
  'profissional novo é ligado aos serviços existentes'
);

insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
select id, 1, '09:00', '12:00' from public.organizations;
insert into public.clients (organization_id, name, phone)
select id, 'Cliente Exemplo', '11999990000' from public.organizations;

-- Validações do banco
select throws_ok(
  $$ insert into public.services (organization_id, name, duration_minutes, price_cents)
     select id, 'Preço negativo', 30, -1 from public.organizations $$,
  '23514', null, 'preço negativo é recusado'
);
select throws_ok(
  $$ insert into public.services (organization_id, name, duration_minutes, price_cents)
     select id, 'Duração quebrada', 7, 100 from public.organizations $$,
  '23514', null, 'duração que não é múltiplo de 5 é recusada'
);
select throws_ok(
  $$ insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
     select id, 1, '11:00', '14:00' from public.organizations $$,
  '23P01', null, 'intervalos sobrepostos no mesmo dia são recusados'
);
select lives_ok(
  $$ insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
     select id, 1, '13:00', '18:00' from public.organizations $$,
  'pausa de almoço (dois intervalos no mesmo dia) é aceita'
);
select throws_ok(
  $$ insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
     select id, 2, '18:00', '09:00' from public.organizations $$,
  '23514', null, 'fechamento antes da abertura é recusado'
);
select throws_ok(
  $$ insert into public.clients (organization_id, name, phone)
     select id, 'Outro Cliente', '11999990000' from public.organizations $$,
  '23505', null, 'telefone repetido no mesmo estabelecimento é recusado'
);
select throws_ok(
  $$ insert into public.clients (organization_id, name, phone)
     select id, 'Telefone Ruim', '(11) 9999-0000' from public.organizations $$,
  '23514', null, 'telefone fora do formato (só dígitos) é recusado'
);

-- Estabelecimento B
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.create_organization('Salão Exemplo B', 'salao-b');

select results_eq(
  $$ select count(*)::int from public.services $$, $$ values (0) $$,
  'B não vê serviços de A'
);
select results_eq(
  $$ select count(*)::int from public.clients $$, $$ values (0) $$,
  'B não vê clientes de A'
);
select results_eq(
  $$ select count(*)::int from public.business_hours $$, $$ values (0) $$,
  'B não vê horários de A'
);
select results_eq(
  $$ select name from public.professionals $$, $$ values ('Salão Exemplo B') $$,
  'B vê só o próprio profissional'
);

-- B tenta gravar no estabelecimento A usando o ID de A
reset role;
create temp table ids as
select
  (select id from public.organizations where slug = 'barbearia-a') as org_a,
  (select id from public.services limit 1) as service_a,
  (select id from public.professionals where name = 'Salão Exemplo B') as professional_b;
grant select on ids to authenticated;
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$ insert into public.services (organization_id, name, duration_minutes, price_cents)
     select org_a, 'Invasão', 30, 100 from ids $$,
  '42501', null, 'B não cria serviço no estabelecimento A'
);
select throws_ok(
  $$ insert into public.clients (organization_id, name) select org_a, 'Invasão' from ids $$,
  '42501', null, 'B não cria cliente no estabelecimento A'
);
select is_empty(
  $$ update public.services set price_cents = 1 where id = (select service_a from ids) returning id $$,
  'B não altera serviço de A'
);
select is_empty(
  $$ delete from public.clients returning id $$,
  'B não apaga clientes de A'
);
select throws_ok(
  $$ insert into public.professional_services (organization_id, professional_id, service_id)
     select (select id from public.organizations), professional_b, service_a from ids $$,
  '23503', null, 'não dá para ligar profissional de B a serviço de A'
);

-- A confere que nada mudou
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select price_cents from public.services $$, $$ values (4500) $$,
  'serviço de A continua intacto'
);

-- Visitante sem login
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.services $$, '42501', null, 'anon não lê serviços');
select throws_ok($$ select * from public.clients $$, '42501', null, 'anon não lê clientes');

select * from finish();
rollback;
