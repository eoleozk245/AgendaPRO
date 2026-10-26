-- Imitação mínima do que o Supabase já traz pronto, para rodar migrações e
-- testes num PostgreSQL comum (scripts/test-db.sh). Não é aplicado no projeto real.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;
create schema auth;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create extension pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text
);

-- Igual ao Supabase: lê o "sub" do token simulado em request.jwt.claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Privilégios padrão do Supabase: tudo que nasce em public fica liberado para
-- anon/authenticated. As migrações precisam revogar o que não deve ser exposto.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

alter database current_database_placeholder set search_path = public, extensions;
