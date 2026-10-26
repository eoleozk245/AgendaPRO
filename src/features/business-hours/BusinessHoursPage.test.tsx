import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderInPanel } from '../../test/render.tsx'
import { BusinessHoursPage } from './BusinessHoursPage.tsx'

const api = vi.hoisted(() => ({
  listBusinessHours: vi.fn(),
  addBusinessHour: vi.fn(),
  deleteBusinessHour: vi.fn(),
}))
vi.mock('./api.ts', () => api)

describe('BusinessHoursPage', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset()
  })

  it('mostra os intervalos por dia e "Fechado" nos demais', async () => {
    api.listBusinessHours.mockResolvedValue([
      {
        id: 'h1',
        organization_id: 'org-1',
        weekday: 1,
        opens_at: '09:00:00',
        closes_at: '12:00:00',
        created_at: '',
      },
    ])
    renderInPanel(<BusinessHoursPage />)
    expect(await screen.findByText(/09:00 – 12:00/)).toBeInTheDocument()
    expect(screen.getAllByText('Fechado')).toHaveLength(6)
  })

  it('recusa fechamento antes da abertura sem chamar o servidor', async () => {
    api.listBusinessHours.mockResolvedValue([])
    renderInPanel(<BusinessHoursPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar intervalo: Sábado' }))
    const dialog = screen.getByRole('dialog', { name: 'Adicionar intervalo' })
    fireEvent.change(within(dialog).getByLabelText(/Abre às/), { target: { value: '18:00' } })
    fireEvent.change(within(dialog).getByLabelText(/Fecha às/), { target: { value: '09:00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('depois da abertura')
    expect(api.addBusinessHour).not.toHaveBeenCalled()
  })

  it('adiciona intervalo no dia escolhido', async () => {
    api.listBusinessHours.mockResolvedValue([])
    api.addBusinessHour.mockResolvedValue(undefined)
    renderInPanel(<BusinessHoursPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar intervalo: Sábado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.addBusinessHour).toHaveBeenCalledWith('org-1', 6, '09:00', '18:00'),
    )
  })
})
