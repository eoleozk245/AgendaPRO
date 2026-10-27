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
  links: [{ professional_id: 'p1', service_id: 's1' }],
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

  describe('com mais de um profissional', () => {
    const team = {
      ...reference,
      services: [
        ...reference.services,
        { ...reference.services[0], id: 's2', name: 'Barba', duration_minutes: 20 },
      ],
      professionals: [
        ...reference.professionals,
        { ...reference.professionals[0], id: 'p2', name: 'Ana Exemplo' },
        { ...reference.professionals[0], id: 'p3', name: 'Beto Exemplo', active: false },
      ],
      // p1 faz só Corte; p2 faz só Barba.
      links: [
        { professional_id: 'p1', service_id: 's1' },
        { professional_id: 'p2', service_id: 's2' },
      ],
    }

    beforeEach(() => api.loadAgendaReference.mockResolvedValue(team))

    it('mostra um profissional por vez e troca pelo seletor', async () => {
      renderAgenda()
      expect(await screen.findByRole('button', { name: /10:00–10:30/ })).toBeInTheDocument()
      const select = screen.getByLabelText('Profissional')
      expect(within(select).getByRole('option', { name: 'Beto Exemplo (inativo)' })).toBeTruthy()
      fireEvent.change(select, { target: { value: 'p2' } })
      expect(screen.queryByRole('button', { name: /10:00–10:30/ })).not.toBeInTheDocument()
      expect(screen.getByText('Nenhum agendamento neste dia.')).toBeInTheDocument()
    })

    it('novo agendamento usa o profissional da agenda e só os serviços dele', async () => {
      api.createAppointment.mockResolvedValue(undefined)
      renderAgenda()
      await screen.findByRole('button', { name: /10:00–10:30/ })
      fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'p2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
      const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' })
      const professional = within(dialog).getByLabelText('Profissional')
      expect(professional).toHaveValue('p2')
      // Inativos não aparecem para novos agendamentos.
      expect(within(professional).queryByRole('option', { name: /Beto/ })).not.toBeInTheDocument()
      const service = within(dialog).getByLabelText('Serviço')
      expect(
        within(service)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual([expect.stringContaining('Barba')])

      // Trocar de profissional troca também o serviço escolhido.
      fireEvent.change(professional, { target: { value: 'p1' } })
      expect(within(dialog).getByLabelText('Serviço')).toHaveValue('s1')
      fireEvent.change(within(dialog).getByLabelText('Cliente'), { target: { value: 'c1' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar' }))
      await waitFor(() =>
        expect(api.createAppointment).toHaveBeenCalledWith(
          'org-1',
          expect.objectContaining({ professionalId: 'p1', serviceId: 's1' }),
        ),
      )
      // A agenda vai para onde o agendamento ficou, para ele não "sumir".
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Novo agendamento' })).not.toBeInTheDocument(),
      )
      expect(screen.getByLabelText('Profissional')).toHaveValue('p1')
    })

    it('a agenda de um inativo é só consulta e o novo agendamento diz quem atende', async () => {
      api.loadAgendaReference.mockResolvedValue({
        ...team,
        professionals: team.professionals.map((p) => (p.id === 'p2' ? { ...p, active: false } : p)),
      })
      renderAgenda()
      await screen.findByRole('button', { name: /10:00–10:30/ })
      fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'p3' } })
      expect(screen.getByText('Beto Exemplo está inativo')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('agenda de Beto Exemplo')
      fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
      const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' })
      // Só um ativo: sem seletor, mas a tela diz para quem vai o agendamento.
      expect(within(dialog).queryByLabelText('Profissional')).not.toBeInTheDocument()
      expect(dialog).toHaveTextContent('Profissional: Profissional')
    })

    it('a semana mostra só os agendamentos e bloqueios do profissional escolhido', async () => {
      api.loadAgenda.mockResolvedValue({
        appointments: [appointment],
        blocks: [
          {
            id: 'b1',
            organization_id: 'org-1',
            professional_id: 'p2',
            starts_at: '2030-01-08T15:00:00Z',
            ends_at: '2030-01-08T16:00:00Z',
            reason: 'Folga',
            created_at: now,
          },
        ],
      })
      renderAgenda()
      await screen.findByRole('button', { name: /10:00–10:30/ })
      fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
      expect(await screen.findByRole('button', { name: /10:00–10:30/ })).toBeInTheDocument()
      expect(screen.queryByText(/Folga/)).not.toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'p2' } })
      expect(screen.queryByRole('button', { name: /10:00–10:30/ })).not.toBeInTheDocument()
      expect(screen.getByText(/Bloqueado 12:00–13:00 · Folga/)).toBeInTheDocument()
    })

    it('avisa quando o profissional não faz nenhum serviço', async () => {
      api.loadAgendaReference.mockResolvedValue({ ...team, links: team.links.slice(0, 1) })
      renderAgenda()
      await screen.findByRole('button', { name: /10:00–10:30/ })
      fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'p2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Novo agendamento' }))
      const dialog = screen.getByRole('dialog', { name: 'Novo agendamento' })
      expect(
        within(dialog).getByText('Ana Exemplo não faz nenhum serviço ativo'),
      ).toBeInTheDocument()
      expect(within(dialog).queryByLabelText('Serviço')).not.toBeInTheDocument()
    })

    it('o bloqueio vale para o profissional escolhido', async () => {
      api.createBlock.mockResolvedValue(undefined)
      renderAgenda()
      await screen.findByRole('button', { name: /10:00–10:30/ })
      fireEvent.change(screen.getByLabelText('Profissional'), { target: { value: 'p2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Bloquear horário' }))
      const dialog = screen.getByRole('dialog', { name: 'Bloquear horário de Ana Exemplo' })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Bloquear' }))
      await waitFor(() =>
        expect(api.createBlock).toHaveBeenCalledWith(
          'org-1',
          'p2',
          '2030-01-07T15:00:00.000Z',
          '2030-01-07T16:00:00.000Z',
          '',
        ),
      )
    })
  })

  it('sem profissional, orienta a cadastrar em Equipe', async () => {
    api.loadAgendaReference.mockResolvedValue({ ...reference, professionals: [], links: [] })
    renderAgenda()
    expect(await screen.findByText('Nenhum profissional cadastrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Equipe' })).toHaveAttribute('href', '/painel/equipe')
    expect(screen.getByRole('button', { name: 'Novo agendamento' })).toBeDisabled()
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
