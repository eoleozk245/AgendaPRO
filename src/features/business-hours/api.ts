import type { BusinessHour } from '../../lib/database.types.ts'
import { throwIfError } from '../../lib/db-errors.ts'
import { supabase } from '../../lib/supabase.ts'

export async function listBusinessHours(organizationId: string): Promise<BusinessHour[]> {
  const { data, error } = await supabase
    .from('business_hours')
    .select('*')
    .eq('organization_id', organizationId)
    .order('weekday')
    .order('opens_at')
  throwIfError(error)
  return data ?? []
}

export async function addBusinessHour(
  organizationId: string,
  weekday: number,
  opensAt: string,
  closesAt: string,
): Promise<void> {
  const { error } = await supabase.from('business_hours').insert({
    organization_id: organizationId,
    weekday,
    opens_at: opensAt,
    closes_at: closesAt,
  })
  throwIfError(error, {
    '23P01': 'Esse intervalo se sobrepõe a outro do mesmo dia.',
    '23514': 'O horário de fechamento precisa ser depois da abertura.',
  })
}

export async function deleteBusinessHour(id: string): Promise<void> {
  const { error } = await supabase.from('business_hours').delete().eq('id', id)
  throwIfError(error)
}
