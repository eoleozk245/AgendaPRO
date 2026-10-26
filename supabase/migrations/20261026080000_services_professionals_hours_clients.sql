-- Etapa 3: serviços, profissionais, horário de funcionamento e clientes.
-- Mesmo padrão da Etapa 2: RLS em tudo, membros leem, dono grava, anon não acessa.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Slugs reservados: o endereço público /{slug} não pode colidir com rotas do app.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add constraint organizations_slug_not_reserved check (
    slug not in (
      'painel', 'entrar', 'cadastro', 'sair', 'conta', 'api', 'admin', 'app', 'assets',
      'static', 'login', 'logout', 'ajuda', 'suporte', 'termos', 'privacidade', 'agendapro'
    )
  );

-- ---------------------------------------------------------------------------
-- professionals
-- ---------------------------------------------------------------------------
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null
    constraint professionals_name_length check (char_length(btrim(name)) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite chaves estrangeiras compostas que garantem o mesmo estabelecimento.
  constraint professionals_id_organization_key unique (id, organization_id)
);

create index professionals_organization_id_idx on public.professionals (organization_id);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null
    constraint services_name_length check (char_length(btrim(name)) between 2 and 80),
  description text
    constraint services_description_length check (char_length(description) <= 500),
  duration_minutes integer not null
    constraint services_duration_valid
      check (duration_minutes between 5 and 480 and duration_minutes % 5 = 0),
  -- Dinheiro sempre em centavos (inteiro). Máximo R$ 100.000,00.
  price_cents integer not null
    constraint services_price_valid check (price_cents between 0 and 10000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_id_organization_key unique (id, organization_id)
);

create index services_organization_id_idx on public.services (organization_id);

-- ---------------------------------------------------------------------------
-- professional_services: quais serviços cada profissional faz.
-- As FKs compostas impedem ligar profissional e serviço de estabelecimentos diferentes.
-- ---------------------------------------------------------------------------
create table public.professional_services (
  organization_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  primary key (professional_id, service_id),
  constraint professional_services_professional_fkey foreign key (professional_id, organization_id)
    references public.professionals (id, organization_id) on delete cascade,
  constraint professional_services_service_fkey foreign key (service_id, organization_id)
    references public.services (id, organization_id) on delete cascade
);

create index professional_services_service_idx on public.professional_services (service_id, organization_id);
create index professional_services_organization_idx on public.professional_services (organization_id);

-- ---------------------------------------------------------------------------
-- business_hours: intervalos de funcionamento por dia da semana (horário local
-- do estabelecimento). Vários intervalos no mesmo dia permitem pausa de almoço.
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- 0 = domingo ... 6 = sábado (igual ao extract(dow) do PostgreSQL e ao getDay() do JS).
  weekday smallint not null
    constraint business_hours_weekday_valid check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  constraint business_hours_interval_valid check (closes_at > opens_at),
  -- Intervalos do mesmo dia não podem se sobrepor.
  constraint business_hours_no_overlap exclude using gist (
    organization_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + opens_at, date '2000-01-01' + closes_at) with &&
  )
);

-- ---------------------------------------------------------------------------
-- clients: só o necessário (LGPD). Telefone guardado só com dígitos (DDD + número).
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null
    constraint clients_name_length check (char_length(btrim(name)) between 2 and 120),
  phone text
    constraint clients_phone_format check (phone ~ '^[0-9]{10,11}$'),
  email text
    constraint clients_email_format
      check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  notes text
    constraint clients_notes_length check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_id_organization_key unique (id, organization_id)
);

create unique index clients_organization_phone_key on public.clients (organization_id, phone)
  where phone is not null;
create index clients_organization_name_idx on public.clients (organization_id, lower(name));

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create trigger professionals_set_updated_at before update on public.professionals
for each row execute function private.set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function private.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- MVP: todo profissional faz todos os serviços. Ao criar um, liga com os outros.
-- (A tela de equipe, fora do MVP, vai permitir escolher.)
-- ---------------------------------------------------------------------------
create function private.link_new_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.professional_services (organization_id, professional_id, service_id)
  select new.organization_id, p.id, new.id
  from public.professionals p
  where p.organization_id = new.organization_id
  on conflict do nothing;
  return new;
end;
$$;

create function private.link_new_professional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.professional_services (organization_id, professional_id, service_id)
  select new.organization_id, new.id, s.id
  from public.services s
  where s.organization_id = new.organization_id
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.link_new_service() from public;
revoke all on function private.link_new_professional() from public;

create trigger services_link_professionals after insert on public.services
for each row execute function private.link_new_service();
create trigger professionals_link_services after insert on public.professionals
for each row execute function private.link_new_professional();

-- ---------------------------------------------------------------------------
-- Privilégios e RLS
-- ---------------------------------------------------------------------------
revoke all on public.professionals, public.services, public.professional_services,
  public.business_hours, public.clients from anon, authenticated;

grant select, insert, update, delete on public.professionals, public.services,
  public.professional_services, public.business_hours, public.clients to authenticated;

alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.clients enable row level security;

-- Mesmo conjunto de policies para as cinco tabelas.
do $$
declare
  t text;
begin
  foreach t in array array['professionals', 'services', 'professional_services', 'business_hours', 'clients']
  loop
    execute format(
      'create policy "Membros leem" on public.%I for select to authenticated
         using ((select private.is_member(organization_id)))', t);
    execute format(
      'create policy "Donos criam" on public.%I for insert to authenticated
         with check ((select private.is_owner(organization_id)))', t);
    execute format(
      'create policy "Donos editam" on public.%I for update to authenticated
         using ((select private.is_owner(organization_id)))
         with check ((select private.is_owner(organization_id)))', t);
    execute format(
      'create policy "Donos apagam" on public.%I for delete to authenticated
         using ((select private.is_owner(organization_id)))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_organization agora também cria o primeiro profissional (o MVP começa
-- com um, com o nome do estabelecimento; o dono pode renomear depois).
-- Mesma assinatura: só o corpo da função muda.
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(org_name text, org_slug text)
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

  if exists (select 1 from public.memberships where user_id = current_user_id) then
    raise exception 'Você já tem um estabelecimento cadastrado.'
      using errcode = 'P0001';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(org_name), lower(btrim(org_slug)))
  returning * into new_org;

  insert into public.memberships (organization_id, user_id, role)
  values (new_org.id, current_user_id, 'owner');

  insert into public.professionals (organization_id, name)
  values (new_org.id, new_org.name);

  return new_org;
end;
$$;

-- Estabelecimentos criados antes desta migração ganham um profissional.
insert into public.professionals (organization_id, name)
select o.id, o.name
from public.organizations o
where not exists (select 1 from public.professionals p where p.organization_id = o.id);
