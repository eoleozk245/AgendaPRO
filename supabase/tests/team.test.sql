-- Etapa 7a: equipe. Profissional ativo e que faz o serviço, serviços por
-- profissional, remarcação, exclusão, página pública e isolamento entre
-- estabelecimentos. Tudo desfeito no final.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@exemplo.test');

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Estabelecimento A: Corte, um segundo profissional, Barba (criada depois dele)
-- e expediente das 09:00 às 18:00 todos os dias.
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Barbearia Exemplo A', 'barbearia-a');
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.professionals (organization_id, name)
select id, 'Profissional Exemplo 2' from public.organizations;
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Barba', 20, 3000 from public.organizations;
insert into public.business_hours (organization_id, weekday, opens_at, closes_at)
select o.id, d, '09:00', '18:00' from public.organizations o, generate_series(0, 6) d;

reset role;
create temp table ids as
select
  (select id from public.organizations where slug = 'barbearia-a') as org_a,
  (select id from public.services where name = 'Corte') as corte,
  (select id from public.services where name = 'Barba') as barba,
  (select id from public.professionals where name = 'Barbearia Exemplo A') as p1,
  (select id from public.professionals where name = 'Profissional Exemplo 2') as p2,
  -- Uma semana à frente no fuso de A: dentro da janela de reservas.
  ((now() at time zone 'America/Sao_Paulo')::date + 7) as dia;
grant select on ids to authenticated, anon;

create function pg_temp.book(professional uuid, service uuid, starts text) returns void
language sql as $$
  insert into public.appointments (organization_id, professional_id, service_id, starts_at)
  select org_a, professional, service, starts::timestamptz from ids;
$$;

create function pg_temp.links(professional uuid) returns setof uuid language sql as $$
  select service_id from public.professional_services
  where professional_id = professional order by service_id;
$$;

create function pg_temp.slots(professional uuid) returns integer language sql as $$
  select count(*)::int
  from ids, public.get_available_slots('barbearia-a', ids.corte, professional, ids.dia);
$$;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');

-- Vínculos automáticos e set_professional_services
select results_eq(
  $$ select count(*)::int from public.professional_services where professional_id = (select p2 from ids) $$,
  $$ values (2) $$,
  'profissional e serviço novos se ligam automaticamente'
);
select lives_ok(
  $$ select pg_temp.book((select p1 from ids), (select corte from ids), '2030-01-07 10:00-03');
     select pg_temp.book((select p2 from ids), (select corte from ids), '2030-01-07 10:00-03') $$,
  'dois profissionais podem atender no mesmo horário'
);
select lives_ok(
  $$ select public.set_professional_services((select p2 from ids), '{}') $$,
  'dono tira todos os serviços de um profissional'
);
select is_empty(
  $$ select pg_temp.links((select p2 from ids)) $$,
  'lista vazia remove todos os vínculos'
);
select throws_ok(
  $$ select pg_temp.book((select p2 from ids), (select corte from ids), '2030-01-07 11:00-03') $$,
  'P0001', 'Esse profissional não faz esse serviço.',
  'agendar serviço que o profissional não faz é recusado'
);
select lives_ok(
  $$ select public.set_professional_services(
       (select p2 from ids),
       array[(select corte from ids), (select corte from ids), null, gen_random_uuid()]
     ) $$,
  'IDs repetidos, nulos e inexistentes não quebram a chamada'
);
select results_eq(
  $$ select pg_temp.links((select p2 from ids)) $$,
  $$ select corte from ids $$,
  'fica só o serviço válido'
);
select results_eq(
  $$ select pg_temp.links((select p1 from ids)) $$,
  $$ select x from ids, unnest(array[corte, barba]) x order by x $$,
  'os serviços dos outros profissionais não mudam'
);
select throws_ok(
  $$ select public.set_professional_services((select p2 from ids), null) $$,
  'P0001', 'Informe a lista de serviços.',
  'lista nula é recusada (não apaga tudo por engano)'
);
select lives_ok(
  $$ select pg_temp.book((select p2 from ids), (select corte from ids), '2030-01-07 11:00-03') $$,
  'com o serviço de volta, o agendamento é aceito'
);

-- Trocas no agendamento
select throws_ok(
  $$ update public.appointments set service_id = (select barba from ids)
     where professional_id = (select p2 from ids) and starts_at = '2030-01-07 11:00-03' $$,
  'P0001', 'Esse profissional não faz esse serviço.',
  'trocar para um serviço que o profissional não faz é recusado'
);
select pg_temp.book((select p1 from ids), (select barba from ids), '2030-01-07 14:00-03');
select throws_ok(
  $$ update public.appointments set professional_id = (select p2 from ids)
     where professional_id = (select p1 from ids) and starts_at = '2030-01-07 14:00-03' $$,
  'P0001', 'Esse profissional não faz esse serviço.',
  'passar para um profissional ativo que não faz o serviço é recusado'
);

-- Profissional inativo
update public.professionals set active = false where id = (select p2 from ids);
select throws_ok(
  $$ select pg_temp.book((select p2 from ids), (select corte from ids), '2030-01-07 12:00-03') $$,
  'P0001', 'Esse profissional está inativo.',
  'profissional inativo não recebe agendamento novo'
);
select throws_ok(
  $$ update public.appointments set starts_at = '2030-01-07 15:00-03'
     where professional_id = (select p2 from ids) and starts_at = '2030-01-07 11:00-03' $$,
  'P0001', 'Esse profissional está inativo.',
  'remarcar agendamento de profissional inativo é recusado'
);
select lives_ok(
  $$ update public.appointments set status = 'cancelled'
     where professional_id = (select p2 from ids) and starts_at = '2030-01-07 11:00-03' $$,
  'agendamento antigo de profissional inativo ainda pode ser cancelado'
);
select throws_ok(
  $$ update public.appointments set professional_id = (select p1 from ids)
     where professional_id = (select p2 from ids) and starts_at = '2030-01-07 11:00-03' $$,
  'P0001', 'Agendamento encerrado não pode ser alterado.',
  'agendamento cancelado não muda de profissional'
);
select throws_ok(
  $$ update public.appointments set professional_id = (select p2 from ids)
     where professional_id = (select p1 from ids) and starts_at = '2030-01-07 10:00-03' $$,
  'P0001', 'Esse profissional está inativo.',
  'não dá para passar agendamento para profissional inativo'
);

-- Exclusão
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

-- Página pública: só quem está ativo e faz o serviço
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select jsonb_array_length(public.get_public_booking_page('barbearia-a') -> 'professionals')),
  1, 'página pública lista só profissionais ativos'
);
select cmp_ok(pg_temp.slots((select p1 from ids)), '>', 0,
  'profissional ativo que faz o serviço tem horários livres');
select is(pg_temp.slots((select p2 from ids)), 0,
  'profissional inativo não tem horários livres');
select is(
  (select public.book_appointment(
     'barbearia-a', ids.corte, ids.p2,
     (select s.starts_at from public.get_available_slots('barbearia-a', ids.corte, ids.p1, ids.dia) s limit 1),
     'Cliente Exemplo', '11987654321'
   ) ->> 'ok' from ids),
  'false', 'reserva pública com profissional inativo é recusada'
);
select throws_ok(
  $$ select public.set_professional_services((select p1 from ids), '{}') $$,
  '42501', null, 'anon não define serviços de profissional'
);

reset role;
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.set_professional_services((select p1 from ids), array[(select barba from ids)]);
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(pg_temp.slots((select p1 from ids)), 0,
  'sem o serviço, o profissional não tem horários livres para ele');

-- Outro estabelecimento não mexe na equipe de A nem descobre nada pelos erros
reset role;
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.create_organization('Salão Exemplo B', 'salao-b');
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte B', 30, 5000 from public.organizations where slug = 'salao-b';

select throws_ok(
  $$ select public.set_professional_services((select p1 from ids), '{}') $$,
  'P0001', 'Profissional não encontrado.',
  'B não altera os serviços de um profissional de A'
);
select lives_ok(
  $$ select public.set_professional_services(
       (select id from public.professionals where name = 'Salão Exemplo B'),
       array[(select corte from ids)]
     ) $$,
  'B chama a função com um serviço de A'
);
select is_empty(
  $$ select pg_temp.links((select id from public.professionals where name = 'Salão Exemplo B')) $$,
  'o serviço de A é ignorado'
);

create function pg_temp.book_in_b(professional uuid, starts text) returns void
language sql as $$
  insert into public.appointments (organization_id, professional_id, service_id, starts_at)
  select o.id, professional, s.id, starts::timestamptz
  from public.organizations o join public.services s on s.organization_id = o.id
  where o.slug = 'salao-b';
$$;
select throws_ok(
  $$ select pg_temp.book_in_b((select p1 from ids), '2030-01-07 10:00-03') $$,
  'P0001', 'Profissional não encontrado.',
  'profissional de A no agendamento de B: horário ocupado em A dá "não encontrado"'
);
select throws_ok(
  $$ select pg_temp.book_in_b((select p1 from ids), '2030-01-07 16:00-03') $$,
  'P0001', 'Profissional não encontrado.',
  'horário livre em A dá a mesma resposta (não revela a agenda de A)'
);
select throws_ok(
  $$ select pg_temp.book((select p2 from ids), (select corte from ids), '2030-01-07 16:00-03') $$,
  '42501', 'Você não tem permissão para fazer isso.',
  'B gravando em A recebe só "sem permissão" (nem "inativo")'
);

select * from finish();
rollback;
