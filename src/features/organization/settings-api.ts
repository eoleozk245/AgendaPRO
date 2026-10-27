import type { Organization, Professional } from '../../lib/database.types.ts'
import { throwIfError } from '../../lib/db-errors.ts'
import { supabase } from '../../lib/supabase.ts'

export async function updateOrganization(
  id: string,
  values: {
    name: string
    timezone: string
    booking_min_notice_minutes: number
    booking_max_days_ahead: number
  },
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error)
  return data as Organization
}

export async function listProfessionals(organizationId: string): Promise<Professional[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at')
  throwIfError(error)
  return data ?? []
}

export async function renameProfessional(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('professionals').update({ name }).eq('id', id)
  throwIfError(error)
}
