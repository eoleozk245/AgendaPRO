-- Correção de segurança: o bloqueio de agenda não revela agendamentos de outro
-- estabelecimento e só o dono grava. Tudo desfeito no final.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@exemplo.test');

create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- A: um profissional com agendamento às 10:00
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.create_organization('Barbearia Exemplo A', 'barbearia-a');
insert into public.services (organization_id, name, duration_minutes, price_cents)
select id, 'Corte', 30, 4500 from public.organizations;
insert into public.appointments (organization_id, professional_id, service_id, starts_at)
select o.id, p.id, s.id, '2030-01-07 10:00-03'
from public.organizations o
join public.professionals p on p.organization_id = o.id
join public.services s on s.organization_id = o.id;

reset role;
create temp table ids as
select
  (select id from public.organizations where slug = 'barbearia-a') as org_a,
  (select id from public.professionals where name = 'Barbearia Exemplo A') as p_a;
grant select on ids to authenticated;

-- B tenta usar o profissional de A num bloqueio do próprio estabelecimento
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.create_organization('Salão Exemplo B', 'salao-b');

create function pg_temp.block(org uuid, professional uuid, starts text, ends text) returns void
language sql as $$
  insert into public.availability_blocks (organization_id, professional_id, starts_at, ends_at)
  values (org, professional, starts::timestamptz, ends::timestamptz);
$$;

select throws_ok(
  $$ select pg_temp.block((select id from public.organizations where slug = 'salao-b'),
       (select p_a from ids), '2030-01-07 10:00-03', '2030-01-07 11:00-03') $$,
  'P0001', 'Profissional não encontrado.',
  'bloquear profissional de A num horário ocupado dá "não encontrado"'
);
select throws_ok(
  $$ select pg_temp.block((select id from public.organizations where slug = 'salao-b'),
       (select p_a from ids), '2030-01-07 14:00-03', '2030-01-07 15:00-03') $$,
  'P0001', 'Profissional não encontrado.',
  'horário livre dá a mesma resposta (não revela a agenda de A)'
);
select throws_ok(
  $$ select pg_temp.block((select org_a from ids), (select p_a from ids),
       '2030-01-07 10:00-03', '2030-01-07 11:00-03') $$,
  '42501', 'Você não tem permissão para fazer isso.',
  'B bloqueando direto em A recebe só "sem permissão"'
);

-- O dono continua usando normalmente
reset role;
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select pg_temp.block((select org_a from ids), (select p_a from ids),
       '2030-01-07 10:00-03', '2030-01-07 11:00-03') $$,
  '23P01', null,
  'dono não bloqueia em cima do próprio agendamento'
);
select lives_ok(
  $$ select pg_temp.block((select org_a from ids), (select p_a from ids),
       '2030-01-07 14:00-03', '2030-01-07 15:00-03') $$,
  'dono bloqueia um horário livre'
);
select throws_ok(
  $$ update public.availability_blocks
     set organization_id = (select id from public.organizations where slug = 'salao-b') $$,
  '42501', 'Você não tem permissão para fazer isso.',
  'dono de A não move o bloqueio para outro estabelecimento'
);

select * from finish();
rollback;
