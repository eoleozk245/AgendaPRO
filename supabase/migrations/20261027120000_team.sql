-- Etapa 7a (D-020): equipe com vários profissionais.
--  * o agendamento exige profissional ativo, do mesmo estabelecimento, que faça
--    o serviço;
--  * pelo painel, só o dono grava agendamento (checado antes das outras regras,
--    para as mensagens de erro não revelarem nada de outro estabelecimento);
--  * set_professional_services define, numa transação só, quais serviços um
--    profissional faz (roda com as permissões de quem chama: a RLS vale).

-- ---------------------------------------------------------------------------
-- Regras do agendamento: mesma função da Etapa 4, com a checagem de equipe.
-- ---------------------------------------------------------------------------
create or replace function private.appointments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  svc public.services;
  professional_active boolean;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then
      raise exception 'Não é possível mover o agendamento para outro estabelecimento.'
        using errcode = '42501';
    end if;

    -- Transições permitidas (D-009). Qualquer outra é recusada.
    if new.status <> old.status and not (
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
      (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show'))
    ) then
      raise exception 'Transição de estado inválida: % para %.', old.status, new.status
        using errcode = 'P0001';
    end if;

    -- Estados finais não mudam mais de horário, serviço ou profissional.
    if old.status in ('completed', 'cancelled', 'no_show') and (
      new.starts_at <> old.starts_at or new.service_id <> old.service_id
      or new.professional_id <> old.professional_id
    ) then
      raise exception 'Agendamento encerrado não pode ser alterado.'
        using errcode = 'P0001';
    end if;

    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_at := now();
    end if;
  else
    -- Pelo painel, só o dono cria. A RLS também confere, mas só depois deste
    -- trigger; checar aqui evita que as mensagens abaixo revelem algo de outro
    -- estabelecimento. Passam a reserva pública (source = 'public', que só
    -- book_appointment grava: a coluna não está no grant de insert) e rotinas
    -- internas sem usuário logado.
    if new.source <> 'public' and (select auth.uid()) is not null
       and not (select private.is_owner(new.organization_id)) then
      raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
    end if;
    if new.status not in ('pending', 'confirmed') then
      raise exception 'Um agendamento novo começa como pendente ou confirmado.'
        using errcode = 'P0001';
    end if;
    new.cancelled_at := null;
  end if;

  -- Equipe (D-020): ao criar, remarcar ou trocar profissional/serviço, o
  -- profissional precisa ser deste estabelecimento e estar ativo. Mudar só o
  -- estado (ex.: cancelar o que estava marcado com alguém desativado) continua
  -- permitido. A linha do profissional fica travada (for share) até o fim da
  -- transação: uma desativação ou troca de serviços simultânea espera.
  if tg_op = 'INSERT' or new.professional_id <> old.professional_id
     or new.service_id <> old.service_id or new.starts_at <> old.starts_at then
    select p.active into professional_active
    from public.professionals p
    where p.id = new.professional_id
      and p.organization_id = new.organization_id
    for share;
    if not found then
      raise exception 'Profissional não encontrado.' using errcode = 'P0001';
    end if;
    if not professional_active then
      raise exception 'Esse profissional está inativo.' using errcode = 'P0001';
    end if;
  end if;

  -- Cópia do serviço: no insert e quando o serviço muda. Valores enviados pelo
  -- cliente para preço/duração/nome são sempre ignorados.
  if tg_op = 'INSERT' or new.service_id <> old.service_id then
    select * into svc
    from public.services s
    where s.id = new.service_id and s.organization_id = new.organization_id;
    if not found then
      raise exception 'Serviço não encontrado.' using errcode = '23503';
    end if;
    new.service_name := svc.name;
    new.duration_minutes := svc.duration_minutes;
    new.price_cents := svc.price_cents;
  else
    new.service_name := old.service_name;
    new.duration_minutes := old.duration_minutes;
    new.price_cents := old.price_cents;
  end if;

  -- O profissional precisa fazer o serviço (ao criar ou ao trocar um dos dois).
  if tg_op = 'INSERT' or new.professional_id <> old.professional_id
     or new.service_id <> old.service_id then
    if not exists (
      select 1 from public.professional_services ps
      where ps.professional_id = new.professional_id
        and ps.service_id = new.service_id
    ) then
      raise exception 'Esse profissional não faz esse serviço.' using errcode = 'P0001';
    end if;
  end if;

  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);

  -- Serializa gravações do mesmo profissional para a checagem de bloqueio
  -- abaixo não sofrer com duas transações simultâneas.
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));

  if new.status <> 'cancelled' and exists (
    select 1
    from public.availability_blocks b
    where b.professional_id = new.professional_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Esse horário está bloqueado na agenda.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Serviços que um profissional faz (substitui a lista inteira).
-- ---------------------------------------------------------------------------
create function public.set_professional_services(
  p_professional_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org uuid;
begin
  if p_service_ids is null then
    raise exception 'Informe a lista de serviços.' using errcode = 'P0001';
  end if;
  -- Sem isto, um nulo na lista faria o "not (... = any ...)" abaixo dar nulo
  -- e nada seria removido.
  p_service_ids := array_remove(p_service_ids, null);

  -- A RLS só deixa ver profissionais do próprio estabelecimento, e o
  -- "for no key update" só alcança quem pode editá-los (o dono). A trava faz
  -- duas gravações ao mesmo tempo terminarem com a última lista, não com a
  -- mistura das duas.
  select p.organization_id into org
  from public.professionals p
  where p.id = p_professional_id
  for no key update;
  if org is null then
    raise exception 'Profissional não encontrado.' using errcode = 'P0001';
  end if;

  delete from public.professional_services ps
  where ps.professional_id = p_professional_id
    and not (ps.service_id = any (p_service_ids));

  -- Só serviços do mesmo estabelecimento; IDs de fora são ignorados.
  insert into public.professional_services (organization_id, professional_id, service_id)
  select org, p_professional_id, s.id
  from public.services s
  where s.organization_id = org
    and s.id = any (p_service_ids)
  on conflict do nothing;
end;
$$;

revoke all on function public.set_professional_services(uuid, uuid[]) from public, anon;
grant execute on function public.set_professional_services(uuid, uuid[]) to authenticated;
