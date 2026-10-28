import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderInPanel, testOrganization } from '../../test/render.tsx'
import { SettingsPage } from './SettingsPage.tsx'

const api = vi.hoisted(() => ({ updateOrganization: vi.fn() }))
vi.mock('./settings-api.ts', () => api)

function renderSettings() {
  return renderInPanel(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    api.updateOrganization.mockReset()
    api.updateOrganization.mockResolvedValue(testOrganization)
  })

  it('salva dados, regras da página e regras do link do cliente', async () => {
    renderSettings()
    fireEvent.change(screen.getByLabelText('Prazo para mudar pelo link'), {
      target: { value: '1440' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Dados salvos.')).toBeInTheDocument()
    expect(api.updateOrganization).toHaveBeenCalledWith('org-1', {
      name: 'Barbearia Exemplo',
      timezone: 'America/Sao_Paulo',
      booking_min_notice_minutes: 120,
      booking_max_days_ahead: 60,
      client_changes_enabled: true,
      client_change_min_notice_minutes: 1440,
    })
  })

  it('desligar as mudanças pelo link desativa o prazo', async () => {
    renderSettings()
    fireEvent.click(
      screen.getByLabelText('O cliente pode cancelar ou remarcar pelo link do agendamento'),
    )
    expect(screen.getByLabelText('Prazo para mudar pelo link')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.updateOrganization).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ client_changes_enabled: false }),
      ),
    )
  })

  it('valida o nome e leva o foco até ele', async () => {
    renderSettings()
    fireEvent.change(screen.getByLabelText(/Nome do estabelecimento/), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(/pelo menos 2 caracteres/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/Nome do estabelecimento/)).toHaveFocus())
    expect(api.updateOrganization).not.toHaveBeenCalled()
  })
})
