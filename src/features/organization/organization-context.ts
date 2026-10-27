import { createContext, useContext } from 'react'
import type { Organization } from '../../lib/database.types.ts'

type OrganizationContextValue = {
  organization: Organization
  setOrganization: (organization: Organization) => void
}

export const OrganizationContext = createContext<OrganizationContextValue | null>(null)

export function useOrganization(): OrganizationContextValue {
  const value = useContext(OrganizationContext)
  if (!value) throw new Error('useOrganization precisa estar dentro do painel.')
  return value
}
