import type { Organization } from '../../lib/database.types.ts'
import { supabase } from '../../lib/supabase.ts'

export type CreateOrganizationResult =
  { ok: true; organization: Organization } | { ok: false; field?: 'slug'; message: string }

/** Busca o estabelecimento do usuário logado. A RLS garante que só o dele volta. */
export async function fetchMyOrganization(): Promise<Organization | null> {
  const { data, error } = await supabase.from('organizations').select('*').maybeSingle()
  if (error) throw new Error('Não foi possível carregar o estabelecimento.')
  return data
}

export async function createOrganization(
  name: string,
  slug: string,
): Promise<CreateOrganizationResult> {
  const { data, error } = await supabase.rpc('create_organization', {
    org_name: name,
    org_slug: slug,
  })

  if (!error) return { ok: true, organization: data }

  switch (error.code) {
    case '23505':
      return { ok: false, field: 'slug', message: 'Esse endereço já está em uso. Escolha outro.' }
    case '23514':
      return { ok: false, message: 'Confira o nome e o endereço e tente de novo.' }
    case 'P0001':
      return { ok: false, message: 'Você já tem um estabelecimento cadastrado.' }
    default:
      return { ok: false, message: 'Não foi possível criar o estabelecimento. Tente de novo.' }
  }
}
