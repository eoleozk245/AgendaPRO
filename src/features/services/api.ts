import type { Service } from '../../lib/database.types.ts'
import { throwIfError } from '../../lib/db-errors.ts'
import { supabase } from '../../lib/supabase.ts'
import type { ServiceFormOutput } from './schemas.ts'

export async function listServices(organizationId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', organizationId)
    .order('active', { ascending: false })
    .order('name')
  throwIfError(error)
  return data ?? []
}

export async function saveService(
  organizationId: string,
  values: ServiceFormOutput,
  id?: string,
): Promise<void> {
  const row = {
    name: values.name,
    description: values.description || null,
    duration_minutes: values.durationMinutes,
    price_cents: values.price,
    active: values.active,
  }
  const { error } = id
    ? await supabase.from('services').update(row).eq('id', id)
    : await supabase.from('services').insert({ ...row, organization_id: organizationId })
  throwIfError(error)
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id)
  throwIfError(error, {
    '23503': 'Esse serviço já tem agendamentos. Desative-o em vez de excluir.',
  })
}
