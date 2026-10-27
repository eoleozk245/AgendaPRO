-- Etapa 7a: equipe. Profissional ativo e que faz o serviço, serviços por
-- profissional, exclusão, isolamento e página pública. Tudo desfeito no final.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@exemplo.test');

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Estabelecimento A: serviço "Corte" e dois profissionais
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Barbearia Exemplo A', 'barbearia-a');
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.professionals (organization_id, name)
select id, 'Profissional Exemplo 2' from public.organizations;

reset role;
create temp table ids as
select
  (select id from public.organizations where slug = 'barbearia-a') as org_a,
  (select id from public.services where name = 'Corte') as corte,
  (select id from public.professionals where name = 'Barbearia Exemplo A') as p1,
  (select id from public.professionals where name = 'Profissional Exemplo 2') as p2;
grant select on ids to authenticated, anon;

create function pg_temp.book(professional uuid, starts text) returns void language sql as $$
  insert into public.appointments (organization_id, professional_id, service_id, starts_at)
  select org_a, professional, corte, starts::timestamptz from ids;
$$;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select count(*)::int from public.professional_services where professional_id = (select p2 from ids) $$,
  $$ values (1) $$,
  'profissional novo já nasce ligado aos serviços existentes'
);

select lives_ok(
  $$ select pg_temp.book((select p1 from ids), '2030-01-07 10:00-03');
     select pg_temp.book((select p2 from ids), '2030-01-07 10:00-03') $$,
  'dois profissionais podem atender no mesmo horário'
);

select lives_ok(
  $$ select public.set_professional_services((select p2 from ids), '{}') $$,
  'dono tira todos os serviços de um profissional'
);
select throws_ok(
  $$ select pg_temp.book((select p2 from ids), '2030-01-07 11:00-03') $$,
  'P0001', 'Esse profissional não faz esse serviço.',
  'agendar serviço que o profissional não faz é recusado'
);
select lives_ok(
  $$ select public.set_professional_services((select p2 from ids), array[(select corte from ids)]) $$,
  'dono devolve o serviço ao profissional'
);
select lives_ok(
  $$ select pg_temp.book((select p2 from ids), '2030-01-07 11:00-03') $$,
  'com o serviço de volta, o agendamento é aceito'
);

update public.professionals set active = false where id = (select p2 from ids);
select throws_ok(
  $$ select pg_temp.book((select p2 from ids), '2030-01-07 12:00-03') $$,
  'P0001', 'Esse profissional está inativo.',
  'profissional inativo não recebe agendamento novo'
);
select lives_ok(
  $$ update public.appointments set status = 'cancelled'
     where professional_id = (select p2 from ids) and starts_at = '2030-01-07 11:00-03' $$,
  'agendamento antigo de profissional inativo ainda pode ser cancelado'
);
select throws_ok(
  $$ update public.appointments set professional_id = (select p2 from ids)
     where professional_id = (select p1 from ids) $$,
  'P0001', 'Esse profissional está inativo.',
  'não dá para passar agendamento para profissional inativo'
);

select throws_ok(
  $$ delete from public.professionals where id = (select p2 from ids) $$,
  '23503', null,
  'profissional com agendamentos não pode ser excluído (desativar)'
);

insert into public.professionals (organization_id, name)
select org_a, 'Profissional Sem Agenda' from ids;
select lives_ok(
  $$ delete from public.professionals where name = 'Profissional Sem Agenda' $$,
  'profissional sem agendamentos pode ser excluído'
);

-- Página pública: só profissionais ativos aparecem
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select jsonb_array_length(public.get_public_booking_page('barbearia-a') -> 'professionals')),
  1, 'página pública lista só profissionais ativos'
);
select throws_ok(
  $$ select public.set_professional_services((select p1 from ids), '{}') $$,
  '42501', null, 'anon não define serviços de profissional'
);

-- Outro estabelecimento não mexe na equipe de A
reset role;
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.create_organization('Salão Exemplo B', 'salao-b');
select throws_ok(
  $$ select public.set_professional_services((select p1 from ids), '{}') $$,
  'P0001', 'Profissional não encontrado.',
  'B não altera os serviços de um profissional de A'
);

select * from finish();
rollback;
