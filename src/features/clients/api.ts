import type { Client } from '../../lib/database.types.ts'
import { throwIfError } from '../../lib/db-errors.ts'
import { supabase } from '../../lib/supabase.ts'
import type { ClientFormOutput } from './schemas.ts'

export async function listClients(organizationId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name')
  throwIfError(error)
  return data ?? []
}

export async function saveClient(
  organizationId: string,
  values: ClientFormOutput,
  id?: string,
): Promise<void> {
  const row = {
    name: values.name,
    phone: values.phone || null,
    email: values.email || null,
    notes: values.notes || null,
  }
  const { error } = id
    ? await supabase.from('clients').update(row).eq('id', id)
    : await supabase.from('clients').insert({ ...row, organization_id: organizationId })
  throwIfError(error, { '23505': 'Já existe um cliente com esse telefone.' })
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  throwIfError(error)
}
