import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserFacingError } from '../../lib/db-errors.ts'
import { renderInPanel } from '../../test/render.tsx'
import { TeamPage } from './TeamPage.tsx'

const api = vi.hoisted(() => ({
  loadTeam: vi.fn(),
  createProfessional: vi.fn(),
  updateProfessional: vi.fn(),
  setProfessionalServices: vi.fn(),
  deleteProfessional: vi.fn(),
}))
vi.mock('./api.ts', () => api)

const service = {
  id: 's1',
  organization_id: 'org-1',
  name: 'Corte',
  description: null,
  duration_minutes: 30,
  price_cents: 4500,
  active: true,
  created_at: '',
  updated_at: '',
}
const services = [
  service,
  { ...service, id: 's2', name: 'Barba' },
  { ...service, id: 's3', name: 'Luzes', active: false },
]
const professional = {
  id: 'p1',
  organization_id: 'org-1',
  name: 'Ana Exemplo',
  active: true,
  created_at: '',
  updated_at: '',
  serviceIds: ['s1'],
}

function renderTeam() {
  return renderInPanel(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>,
  )
}

describe('TeamPage', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset()
    api.loadTeam.mockResolvedValue({ professionals: [professional], services })
  })

  it('lista profissionais com os serviços e a situação', async () => {
    renderTeam()
    const row = (await screen.findByText('Ana Exemplo')).closest('tr')!
    expect(within(row).getByText('Corte')).toBeInTheDocument()
    expect(within(row).getByText('Ativo')).toBeInTheDocument()
  })

  it('avisa quando ninguém está ativo', async () => {
    api.loadTeam.mockResolvedValue({
      professionals: [{ ...professional, active: false, serviceIds: [] }],
      services,
    })
    renderTeam()
    expect(await screen.findByText('Nenhum profissional ativo')).toBeInTheDocument()
    // Inativo sem serviço não precisa de alerta.
    expect(screen.getByText('Nenhum serviço')).toBeInTheDocument()
  })

  it('mostra o estado vazio com ação de cadastrar', async () => {
    api.loadTeam.mockResolvedValue({ professionals: [], services })
    renderTeam()
    expect(await screen.findByText('Nenhum profissional cadastrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo profissional' })).toBeInTheDocument()
  })

  it('novo profissional começa com os serviços ativos e salva a escolha', async () => {
    api.createProfessional.mockResolvedValue('p2')
    api.setProfessionalServices.mockResolvedValue(undefined)
    renderTeam()
    fireEvent.click(await screen.findByRole('button', { name: 'Novo profissional' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo profissional' })
    // Igual ao banco: começa com todos os serviços, inclusive os inativos.
    expect(within(dialog).getByLabelText('Corte')).toBeChecked()
    expect(within(dialog).getByLabelText('Barba')).toBeChecked()
    expect(within(dialog).getByLabelText('Luzes')).toBeChecked()

    fireEvent.change(within(dialog).getByLabelText(/Nome/), { target: { value: ' Beto ' } })
    fireEvent.click(within(dialog).getByLabelText('Barba'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.setProfessionalServices).toHaveBeenCalledWith('p2', ['s1', 's3']),
    )
    expect(api.createProfessional).toHaveBeenCalledWith('org-1', 'Beto', true)
  })

  it('se escolher serviços falhar, salvar de novo não cria outro profissional', async () => {
    api.createProfessional.mockResolvedValue('p2')
    api.setProfessionalServices
      .mockRejectedValueOnce(new UserFacingError('Falhou.'))
      .mockResolvedValue(undefined)
    renderTeam()
    fireEvent.click(await screen.findByRole('button', { name: 'Novo profissional' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo profissional' })
    fireEvent.change(within(dialog).getByLabelText(/Nome/), { target: { value: 'Beto' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Falhou.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(api.setProfessionalServices).toHaveBeenCalledTimes(2))
    expect(api.createProfessional).toHaveBeenCalledTimes(1)
    expect(api.updateProfessional).toHaveBeenCalledWith('p2', 'Beto', true)
  })

  it('se cancelar depois de criar pela metade, a lista recarrega e mostra quem foi criado', async () => {
    api.createProfessional.mockResolvedValue('p2')
    api.setProfessionalServices.mockRejectedValue(new UserFacingError('Falhou.'))
    renderTeam()
    fireEvent.click(await screen.findByRole('button', { name: 'Novo profissional' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo profissional' })
    fireEvent.change(within(dialog).getByLabelText(/Nome/), { target: { value: 'Beto' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await within(dialog).findByRole('alert')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(api.loadTeam).toHaveBeenCalledTimes(2))
  })

  it('marca serviço inativo e avisa quem está ativo sem nenhum serviço ativo', async () => {
    api.loadTeam.mockResolvedValue({
      professionals: [
        { ...professional, serviceIds: ['s1', 's3'] },
        { ...professional, id: 'p2', name: 'Beto Exemplo', serviceIds: ['s3'] },
      ],
      services,
    })
    renderTeam()
    const ana = (await screen.findByText('Ana Exemplo')).closest('tr')!
    expect(within(ana).getByText('Corte, Luzes (inativo)')).toBeInTheDocument()
    const beto = screen.getByText('Beto Exemplo').closest('tr')!
    expect(within(beto).getByText('Nenhum serviço ativo')).toBeInTheDocument()
  })

  it('edita nome, situação e serviços', async () => {
    api.updateProfessional.mockResolvedValue(undefined)
    api.setProfessionalServices.mockResolvedValue(undefined)
    renderTeam()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana Exemplo' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar profissional' })
    expect(within(dialog).getByLabelText('Barba')).not.toBeChecked()
    fireEvent.click(within(dialog).getByLabelText('Ativo'))
    fireEvent.click(within(dialog).getByLabelText('Barba'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(api.setProfessionalServices).toHaveBeenCalledWith('p1', ['s1', 's2']),
    )
    expect(api.updateProfessional).toHaveBeenCalledWith('p1', 'Ana Exemplo', false)
  })

  it('valida o nome antes de enviar', async () => {
    renderTeam()
    fireEvent.click(await screen.findByRole('button', { name: 'Novo profissional' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo profissional' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(await within(dialog).findByText(/pelo menos 2 caracteres/)).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByLabelText(/Nome/)).toHaveFocus())
    expect(api.createProfessional).not.toHaveBeenCalled()
  })

  it('mostra a mensagem do banco quando a exclusão é recusada', async () => {
    api.deleteProfessional.mockRejectedValue(
      new UserFacingError('Esse profissional já tem agendamentos. Desative-o em vez de excluir.'),
    )
    renderTeam()
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Ana Exemplo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Desative-o em vez de excluir')
  })
})
