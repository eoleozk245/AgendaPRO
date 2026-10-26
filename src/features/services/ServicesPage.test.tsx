import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderInPanel } from '../../test/render.tsx'
import { ServicesPage } from './ServicesPage.tsx'

const api = vi.hoisted(() => ({
  listServices: vi.fn(),
  saveService: vi.fn(),
  deleteService: vi.fn(),
}))
vi.mock('./api.ts', () => api)

const service = {
  id: 's1',
  organization_id: 'org-1',
  name: 'Corte de cabelo',
  description: null,
  duration_minutes: 30,
  price_cents: 4500,
  active: true,
  created_at: '',
  updated_at: '',
}

describe('ServicesPage', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset()
  })

  it('mostra o estado vazio com ação de cadastrar', async () => {
    api.listServices.mockResolvedValue([])
    renderInPanel(<ServicesPage />)
    expect(await screen.findByText('Nenhum serviço cadastrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo serviço' })).toBeInTheDocument()
  })

  it('lista serviços com duração, preço e situação', async () => {
    api.listServices.mockResolvedValue([service])
    renderInPanel(<ServicesPage />)
    const row = (await screen.findByText('Corte de cabelo')).closest('tr')!
    expect(within(row).getByText('30 min')).toBeInTheDocument()
    expect(within(row).getByText(/45,00/)).toBeInTheDocument()
    expect(within(row).getByText('Ativo')).toBeInTheDocument()
  })

  it('cria um serviço convertendo o preço para centavos', async () => {
    api.listServices.mockResolvedValue([])
    api.saveService.mockResolvedValue(undefined)
    renderInPanel(<ServicesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo serviço' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo serviço' })
    fireEvent.change(within(dialog).getByLabelText(/Nome/), { target: { value: 'Barba' } })
    fireEvent.change(within(dialog).getByLabelText(/Preço/), { target: { value: '30,50' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.saveService).toHaveBeenCalledWith(
        'org-1',
        { name: 'Barba', description: '', durationMinutes: 30, price: 3050, active: true },
        undefined,
      ),
    )
  })

  it('mostra erro e permite tentar de novo quando a lista falha', async () => {
    api.listServices.mockRejectedValueOnce(new Error('rede')).mockResolvedValue([service])
    renderInPanel(<ServicesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Corte de cabelo')).toBeInTheDocument()
  })

  it('mostra a mensagem do banco quando a exclusão é recusada', async () => {
    const { UserFacingError } = await import('../../lib/db-errors.ts')
    api.listServices.mockResolvedValue([service])
    api.deleteService.mockRejectedValue(
      new UserFacingError('Esse serviço já tem agendamentos. Desative-o em vez de excluir.'),
    )
    renderInPanel(<ServicesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Corte de cabelo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Desative-o em vez de excluir')
  })
})
