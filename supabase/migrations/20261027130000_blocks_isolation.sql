-- Correção de segurança (revisão da Etapa 7a). O trigger dos bloqueios roda
-- antes da RLS e procurava agendamentos só pelo profissional. Um usuário logado
-- podia "bloquear", no próprio estabelecimento, o profissional de outro (os IDs
-- aparecem na página pública) e, pela mensagem de erro, descobrir quando ele
-- tinha agendamento. Agora, antes de qualquer consulta: só o dono grava, e o
-- profissional precisa ser do mesmo estabelecimento do bloqueio.
create or replace function private.availability_blocks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rotinas internas sem usuário logado passam; pela API, só o dono.
  if (select auth.uid()) is not null
     and not (select private.is_owner(new.organization_id)) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.professionals p
    where p.id = new.professional_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'Profissional não encontrado.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));
  if exists (
    select 1
    from public.appointments a
    where a.professional_id = new.professional_id
      and a.organization_id = new.organization_id
      and a.status <> 'cancelled'
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Já existe agendamento nesse período. Cancele ou remarque antes de bloquear.'
      using errcode = '23P01';
  end if;
  return new;
end;
$$;
