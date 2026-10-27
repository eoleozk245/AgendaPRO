import type { Organization } from '../../lib/database.types.ts'
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
