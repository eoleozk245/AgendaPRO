import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Organization } from '../lib/database.types.ts'
import { OrganizationContext } from '../features/organization/organization-context.ts'

export const testOrganization: Organization = {
  id: 'org-1',
  name: 'Barbearia Exemplo',
  slug: 'barbearia-exemplo',
  timezone: 'America/Sao_Paulo',
  booking_min_notice_minutes: 120,
  booking_max_days_ahead: 60,
  client_changes_enabled: true,
  client_change_min_notice_minutes: 120,
  created_at: '',
  updated_at: '',
}

/** Renderiza uma tela do painel com um estabelecimento de exemplo. */
export function renderInPanel(ui: ReactNode, organization: Organization = testOrganization) {
  return render(
    <OrganizationContext.Provider value={{ organization, setOrganization: () => {} }}>
      {ui}
    </OrganizationContext.Provider>,
  )
}
