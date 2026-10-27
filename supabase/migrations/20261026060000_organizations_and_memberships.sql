-- Etapa 2: estabelecimentos (organizations) e vínculo de usuários (memberships).
-- Toda tabela com dados protegidos tem RLS ligada. O público (anon) não acessa nada.
-- A criação de um estabelecimento passa pela função create_organization, nunca por
-- insert direto, para que estabelecimento e dono nasçam juntos e validados.

-- Funções internas ficam fora do schema public, que é o exposto pela API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Validação de fuso horário (usada no CHECK de organizations).
-- ---------------------------------------------------------------------------
create function private.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint organizations_name_length check (char_length(btrim(name)) between 2 and 80),
  -- Endereço público /{slug}: minúsculas, números e hífens simples (D-013).
  slug text not null
    constraint organizations_slug_format
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  timezone text not null default 'America/Sao_Paulo'
    constraint organizations_timezone_valid check (private.is_valid_timezone(timezone)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_key unique (slug)
);

comment on table public.organizations is 'Estabelecimentos (barbearias, salões). Cada um isola seus dados por RLS.';

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Só existe "owner" no MVP. Novos papéis entram junto com a tela de equipe.
  role text not null default 'owner'
    constraint memberships_role_valid check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

comment on table public.memberships is 'Liga usuários (auth.users) aos estabelecimentos e define o papel de cada um.';

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções de permissão usadas pelas policies.
-- SECURITY DEFINER para ler memberships sem cair na própria RLS (evita recursão).
-- O usuário vem sempre de auth.uid() (o token), nunca de um parâmetro do cliente.
-- ---------------------------------------------------------------------------
create function private.is_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke all on function private.is_valid_timezone(text) from public;
revoke all on function private.set_updated_at() from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_owner(uuid) from public;
grant execute on function private.is_valid_timezone(text) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios: o Supabase concede tudo a anon/authenticated por padrão em
-- tabelas novas do schema public. Aqui deixamos só o necessário.
-- ---------------------------------------------------------------------------
revoke all on public.organizations from anon, authenticated;
revoke all on public.memberships from anon, authenticated;

grant select on public.organizations to authenticated;
-- O slug não muda pela API: trocar quebraria links públicos já divulgados.
grant update (name, timezone) on public.organizations to authenticated;
grant select on public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy "Membros veem o próprio estabelecimento"
on public.organizations for select
to authenticated
using ((select private.is_member(id)));

create policy "Donos editam o próprio estabelecimento"
on public.organizations for update
to authenticated
using ((select private.is_owner(id)))
with check ((select private.is_owner(id)));

create policy "Membros veem os vínculos do próprio estabelecimento"
on public.memberships for select
to authenticated
using ((select private.is_member(organization_id)));

-- Sem policies de insert/delete: ninguém cria ou apaga direto pela API.

-- ---------------------------------------------------------------------------
-- create_organization: cria o estabelecimento e o vínculo de dono juntos.
-- ---------------------------------------------------------------------------
create function public.create_organization(org_name text, org_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_org public.organizations;
begin
  if current_user_id is null then
    raise exception 'Faça login para criar um estabelecimento.'
      using errcode = '42501';
  end if;

  -- MVP: cada usuário participa de no máximo um estabelecimento (D-013).
  if exists (select 1 from public.memberships where user_id = current_user_id) then
    raise exception 'Você já tem um estabelecimento cadastrado.'
      using errcode = 'P0001';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(org_name), lower(btrim(org_slug)))
  returning * into new_org;

  insert into public.memberships (organization_id, user_id, role)
  values (new_org.id, current_user_id, 'owner');

  return new_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
