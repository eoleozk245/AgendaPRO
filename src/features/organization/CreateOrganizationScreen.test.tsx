import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateOrganizationScreen } from './CreateOrganizationScreen.tsx'

const api = vi.hoisted(() => ({ createOrganization: vi.fn() }))
vi.mock('./api.ts', () => api)

const organization = {
  id: 'org-1',
  name: 'Barbearia do Zé',
  slug: 'barbearia-do-ze',
  timezone: 'America/Sao_Paulo',
  booking_min_notice_minutes: 120,
  booking_max_days_ahead: 60,
  created_at: '',
  updated_at: '',
}

describe('CreateOrganizationScreen', () => {
  beforeEach(() => api.createOrganization.mockReset())

  it('sugere o endereço a partir do nome', () => {
    render(<CreateOrganizationScreen onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Nome do estabelecimento/), {
      target: { value: 'Barbearia do Zé' },
    })
    expect(screen.getByLabelText(/Endereço/)).toHaveValue('barbearia-do-ze')
  })

  it('mostra erro no campo de endereço quando ele já está em uso', async () => {
    api.createOrganization.mockResolvedValue({
      ok: false,
      field: 'slug',
      message: 'Esse endereço já está em uso. Escolha outro.',
    })
    render(<CreateOrganizationScreen onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Nome do estabelecimento/), {
      target: { value: 'Barbearia do Zé' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar estabelecimento' }))
    await waitFor(() =>
      expect(screen.getByLabelText(/Endereço/)).toHaveAccessibleDescription(
        /Esse endereço já está em uso/,
      ),
    )
  })

  it('avisa a tela principal quando o estabelecimento é criado', async () => {
    api.createOrganization.mockResolvedValue({ ok: true, organization })
    const onCreated = vi.fn()
    render(<CreateOrganizationScreen onCreated={onCreated} />)
    fireEvent.change(screen.getByLabelText(/Nome do estabelecimento/), {
      target: { value: 'Barbearia do Zé' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar estabelecimento' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(organization))
    expect(api.createOrganization).toHaveBeenCalledWith('Barbearia do Zé', 'barbearia-do-ze')
  })
})
