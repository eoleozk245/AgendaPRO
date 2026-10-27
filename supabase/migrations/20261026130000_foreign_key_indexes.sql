-- Índices para as chaves estrangeiras compostas (profissional + estabelecimento),
-- apontadas pelo Advisor de desempenho do Supabase. Acelera apagar/consultar por
-- profissional nas tabelas que apontam para professionals.

create index appointments_professional_idx
  on public.appointments (professional_id, organization_id);

create index availability_blocks_professional_org_idx
  on public.availability_blocks (professional_id, organization_id);

create index professional_services_professional_org_idx
  on public.professional_services (professional_id, organization_id);
