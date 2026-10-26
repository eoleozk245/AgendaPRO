import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserFacingError } from '../../lib/db-errors.ts'
import { renderInPanel } from '../../test/render.tsx'
import { AgendaPage } from './AgendaPage.tsx'
import type { AgendaAppointment } from './api.ts'

const api = vi.hoisted(() => ({
  loadAgenda: vi.fn(),
  loadAgendaReference: vi.fn(),
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
}))
vi.mock('./api.ts', () => api)

const now = ''
const reference = {
  services: [
    {
      id: 's1',
      organization_id: 'org-1',
      name: 'Corte',
      description: null,
      duration_minutes: 30,
      price_cents: 4500,
      active: true,
      created_at: now,
      updated_at: now,
    },
  ],
  clients: [
    {
      id: 'c1',
      organization_id: 'org-1',
      name: 'Cliente Exemplo',
      phone: '11987654321',
      email: null,
      notes: null,
      created_at: now,
      updated_at: now,
    },
  ],
  professionals: [
    {
      id: 'p1',
      organization_id: 'org-1',
      name: 'Profissional',
      active: true,
      created_at: now,
      updated_at: now,
    },
  ],
  hours: [
    {
      id: 'h1',
      organization_id: 'org-1',
      weekday: 1,
      opens_at: '09:00:00',
      closes_at: '18:00:00',
      created_at: now,
    },
  ],
}

const appointment: AgendaAppointment = {
  id: 'a1',
  // 2030-01-07 é segunda-feira. 13:00 UTC = 10:00 em São Paulo.
  starts_at: '2030-01-07T13:00:00Z',
  ends_at: '2030-01-07T13:30:00Z',
  status: 'confirmed',
  service_id: 's1',
  service_name: 'Corte',
  price_cents: 4500,
  duration_minutes: 30,
  client_id: 'c1',
  professional_id: 'p1',
  notes: null,
  source: 'public',
  client: { name: 'Cliente Exemplo', phone: '11987654321' },
}

function renderAgenda() {
  return renderInPanel(
    <MemoryRouter>
      <AgendaPage />
    </MemoryRouter>,
  )
}

describe('AgendaPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-07T12:00:00Z')) // 09:00 em São Paulo
    for (const fn of Object.values(api)) fn.mockReset()
    api.loadAgendaReference.mockResolvedValue(reference)
    api.loadAgenda.mockResolvedValue({ appointments: [appointment], blocks: [] })
  })

  afterEach(() => vi.useRealTimers())

  it('busca o dia inteiro no fuso do estabelecimento e mostra o agendamento', async () => {
    renderAgenda()
    expect(
      await screen.findByRole('button', {
        name: '10:00–10:30 Cliente Exemplo · Corte Confirmado',
      }),
    ).toBeInTheDocument()
    expect(api.loadAgenda).toHaveBeenCalledWith(
      'org-1',
      '2030-01-07T03:00:00.000Z',
      '2030-01-08T03:00:00.000Z',
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'segunda-feira, 7 de janeiro',
    )
  })

  it('navega entre dias e troca para a semana', async () => {
    renderAgenda()
    await screen.findByText(/Cliente Exemplo/)
    fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }))
    await waitFor(() =>
      expect(api.loadAgenda).toHaveBeenLastCalledWith(
        'org-1',
        '2030-01-06T03:00:00.000Z',
        '2030-01-07T03:00:00.000Z',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    await waitFor(() =>
      expect(api.loadAgenda).toHaveBeenLastCalledWith(
        'org-1',
        '2029-12-31T03:00:00.000Z',
        '2030-01-07T03:00:00.000Z',
      ),
    )
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cria agendamento convertendo o horário local para UTC', async () => {
    api.loadAgenda.mockResolvedValue({ appointments: [], blocks: [] })
    api.createAppointment.mockResolvedValue(undefined)
    renderAgenda()
    expect(await screen.findByText('Nenhum agendamento neste dia.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' })
    fireEvent.change(within(dialog).getByLabelText('Cliente'), { target: { value: 'c1' } })
    fireEvent.change(within(dialog).getByLabelText(/^Horário/), { target: { value: '14:30' } })
    expect(within(dialog).getByText('Termina às 15:00')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar' }))
    await waitFor(() =>
      expect(api.createAppointment).toHaveBeenCalledWith('org-1', {
        clientId: 'c1',
        serviceId: 's1',
        professionalId: 'p1',
        startsAt: '2030-01-07T17:30:00.000Z',
        notes: '',
      }),
    )
  })

  it('avisa (sem bloquear) quando o horário está fora do expediente', async () => {
    renderAgenda()
    await screen.findByText(/Cliente Exemplo/)
    fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' })
    fireEvent.change(within(dialog).getByLabelText(/^Horário/), { target: { value: '19:00' } })
    expect(within(dialog).getByText('Fora do horário de funcionamento')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Agendar' })).toBeEnabled()
  })

  it('mostra o conflito vindo do banco', async () => {
    api.createAppointment.mockRejectedValue(
      new UserFacingError('Esse horário conflita com outro agendamento.'),
    )
    renderAgenda()
    await screen.findByText(/Cliente Exemplo/)
    fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' })
    fireEvent.change(within(dialog).getByLabelText('Cliente'), { target: { value: 'c1' } })
    fireEvent.change(within(dialog).getByLabelText(/^Horário/), { target: { value: '10:00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('conflita')
  })

  it('antes do horário só oferece cancelar; cancelamento pede confirmação', async () => {
    api.setAppointmentStatus.mockResolvedValue(undefined)
    renderAgenda()
    fireEvent.click(await screen.findByRole('button', { name: /10:00–10:30/ }))
    const dialog = screen.getByRole('dialog', { name: 'Editar agendamento' })
    expect(within(dialog).queryByRole('button', { name: /concluído/ })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar agendamento' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sim, cancelar' }))
    await waitFor(() => expect(api.setAppointmentStatus).toHaveBeenCalledWith('a1', 'cancelled'))
  })

  it('depois do horário permite marcar como concluído', async () => {
    vi.setSystemTime(new Date('2030-01-07T13:40:00Z'))
    api.setAppointmentStatus.mockResolvedValue(undefined)
    renderAgenda()
    fireEvent.click(await screen.findByRole('button', { name: /10:00–10:30/ }))
    fireEvent.click(screen.getByRole('button', { name: /Marcar como concluído/ }))
    await waitFor(() => expect(api.setAppointmentStatus).toHaveBeenCalledWith('a1', 'completed'))
  })

  it('agendamento cancelado aparece só para consulta', async () => {
    api.loadAgenda.mockResolvedValue({
      appointments: [{ ...appointment, status: 'cancelled' }],
      blocks: [],
    })
    renderAgenda()
    expect(await screen.findByText('Cancelados neste dia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cliente Exemplo/ }))
    const dialog = screen.getByRole('dialog', { name: 'Agendamento' })
    expect(within(dialog).queryByRole('button', { name: /Salvar/ })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })
})
