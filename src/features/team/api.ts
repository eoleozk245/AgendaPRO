import type { Professional, Service } from '../../lib/database.types.ts'
import { throwIfError } from '../../lib/db-errors.ts'
import { supabase } from '../../lib/supabase.ts'

export type TeamMember = Professional & { serviceIds: string[] }
export type TeamData = { professionals: TeamMember[]; services: Service[] }

/** Profissionais (ativos primeiro), com os serviços que cada um faz. */
export async function loadTeam(organizationId: string): Promise<TeamData> {
  const [professionals, services, links] = await Promise.all([
    supabase
      .from('professionals')
      .select('*')
      .eq('organization_id', organizationId)
      .order('active', { ascending: false })
      .order('created_at'),
    supabase.from('services').select('*').eq('organization_id', organizationId).order('name'),
    supabase
      .from('professional_services')
      .select('professional_id, service_id')
      .eq('organization_id', organizationId),
  ])
  throwIfError(professionals.error)
  throwIfError(services.error)
  throwIfError(links.error)
  const linkRows = links.data ?? []
  return {
    professionals: (professionals.data ?? []).map((professional) => ({
      ...professional,
      serviceIds: linkRows
        .filter((link) => link.professional_id === professional.id)
        .map((link) => link.service_id),
    })),
    services: services.data ?? [],
  }
}

/** Cria o profissional e devolve o id. O banco já o liga a todos os serviços. */
export async function createProfessional(
  organizationId: string,
  name: string,
  active: boolean,
): Promise<string> {
  const { data, error } = await supabase
    .from('professionals')
    .insert({ organization_id: organizationId, name, active })
    .select('id')
    .single()
  throwIfError(error)
  return (data as Pick<Professional, 'id'>).id
}

export async function updateProfessional(id: string, name: string, active: boolean) {
  const { error } = await supabase.from('professionals').update({ name, active }).eq('id', id)
  throwIfError(error)
}

/** Troca a lista inteira de serviços do profissional (numa transação, no banco). */
export async function setProfessionalServices(id: string, serviceIds: string[]) {
  const { error } = await supabase.rpc('set_professional_services', {
    p_professional_id: id,
    p_service_ids: serviceIds,
  })
  throwIfError(error)
}

export async function deleteProfessional(id: string) {
  const { error } = await supabase.from('professionals').delete().eq('id', id)
  throwIfError(error, {
    '23503': 'Esse profissional já tem agendamentos. Desative-o em vez de excluir.',
  })
}
