-- Prova que um estabelecimento não enxerga nem altera os dados de outro.
-- Roda dentro de uma transação desfeita no final: nada fica gravado.
-- Local: `supabase test db`. Remoto: ver docs/DATABASE.md.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

-- Dois donos fictícios, identificados como exemplo.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@exemplo.test'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@exemplo.test');

-- Simula requisições autenticadas de cada usuário (o que o token JWT faria).
create function pg_temp.login_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Usuário A cria o estabelecimento A
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.create_organization('Barbearia Exemplo A', 'barbearia-a') $$,
  'dono A cria o próprio estabelecimento'
);

-- Usuário B cria o estabelecimento B
select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$ select public.create_organization('Salão Exemplo B', 'salao-b') $$,
  'dono B cria o próprio estabelecimento'
);

-- B só enxerga o próprio estabelecimento e o próprio vínculo
select results_eq(
  $$ select slug from public.organizations $$,
  $$ values ('salao-b') $$,
  'B vê só o estabelecimento B'
);
select results_eq(
  $$ select count(*)::int from public.memberships $$,
  $$ values (1) $$,
  'B vê só o próprio vínculo'
);

-- B tenta alterar o estabelecimento A: nenhuma linha é afetada
select is_empty(
  $$ update public.organizations set name = 'Invadido' where slug = 'barbearia-a' returning id $$,
  'B não consegue alterar o estabelecimento A'
);

-- B não cria vínculos nem estabelecimentos direto nas tabelas
select throws_ok(
  $$ insert into public.memberships (organization_id, user_id)
     select id, '00000000-0000-0000-0000-00000000000b' from public.organizations limit 1 $$,
  '42501', null,
  'B não insere vínculos direto na tabela'
);
select throws_ok(
  $$ insert into public.organizations (name, slug) values ('Outro', 'outro') $$,
  '42501', null,
  'B não insere estabelecimentos direto na tabela'
);
select throws_ok(
  $$ delete from public.organizations $$,
  '42501', null,
  'B não apaga estabelecimentos'
);

-- B não muda o slug (link público) do próprio estabelecimento
select throws_ok(
  $$ update public.organizations set slug = 'novo-slug' $$,
  '42501', null,
  'slug não pode ser alterado pela API'
);

-- B edita o próprio estabelecimento
select lives_ok(
  $$ update public.organizations set name = 'Salão Exemplo B Renomeado' where slug = 'salao-b' $$,
  'B edita o próprio estabelecimento'
);

-- Regra do MVP: um estabelecimento por usuário
select throws_ok(
  $$ select public.create_organization('Segundo', 'segundo-b') $$,
  'P0001', 'Você já tem um estabelecimento cadastrado.',
  'B não cria um segundo estabelecimento'
);

-- A continua vendo só o seu, e o nome não foi alterado por B
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select name from public.organizations $$,
  $$ values ('Barbearia Exemplo A') $$,
  'A vê só o estabelecimento A, intacto'
);

-- Slug duplicado é recusado pelo banco
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'dono-c@exemplo.test');
select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.create_organization('Copia', 'salao-b') $$,
  '23505', null,
  'slug repetido é recusado'
);
select throws_ok(
  $$ select public.create_organization('Slug ruim', 'Slug Ruim!') $$,
  '23514', null,
  'slug fora do formato é recusado'
);

-- Visitante sem login (anon) não lê nada nem cria estabelecimento
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$ select * from public.organizations $$,
  '42501', null,
  'anon não lê estabelecimentos'
);
select throws_ok(
  $$ select public.create_organization('Anonimo', 'anonimo') $$,
  '42501', null,
  'anon não cria estabelecimentos'
);

select * from finish();
rollback;
