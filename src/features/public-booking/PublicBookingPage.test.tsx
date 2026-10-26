import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicPage } from './api.ts'
import { PublicBookingPage } from './PublicBookingPage.tsx'

const api = vi.hoisted(() => ({
  fetchPublicPage: vi.fn(),
  fetchSlots: vi.fn(),
  bookAppointment: vi.fn(),
}))
vi.mock('./api.ts', () => api)

const page: PublicPage = {
  organization: {
    name: 'Barbearia Exemplo',
    slug: 'barbearia-exemplo',
    timezone: 'America/Sao_Paulo',
    min_notice_minutes: 120,
    max_days_ahead: 30,
  },
  services: [
    {
      id: 's1',
      name: 'Corte',
      description: 'Corte com tesoura',
      duration_minutes: 30,
      price_cents: 4500,
    },
  ],
  professionals: [{ id: 'p1', name: 'Profissional Exemplo', service_ids: ['s1'] }],
}

function renderPage(path = '/barbearia-exemplo') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:slug" element={<PublicBookingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function chooseUntilSlot() {
  fireEvent.click(await screen.findByRole('radio', { name: /Corte/ }))
  expect(screen.getByText('Com Profissional Exemplo')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Hoje' }))
  fireEvent.click(await screen.findByRole('radio', { name: '14:30' }))
}

describe('PublicBookingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-07T12:00:00Z'))
    for (const fn of Object.values(api)) fn.mockReset()
    api.fetchPublicPage.mockResolvedValue(page)
    api.fetchSlots.mockResolvedValue(['2030-01-07T17:30:00Z', '2030-01-07T17:45:00Z'])
  })

  afterEach(() => vi.useRealTimers())

  it('endereço desconhecido mostra aviso', async () => {
    api.fetchPublicPage.mockResolvedValue(null)
    renderPage('/nao-existe')
    expect(await screen.findByText('Página de agendamento não encontrada')).toBeInTheDocument()
  })

  it('busca horários livres do dia escolhido e mostra no fuso do estabelecimento', async () => {
    renderPage()
    await chooseUntilSlot()
    expect(api.fetchSlots).toHaveBeenCalledWith('barbearia-exemplo', 's1', 'p1', '2030-01-07')
    expect(screen.getByRole('radio', { name: '14:45' })).toBeInTheDocument()
    expect(screen.getByText(/Corte · segunda-feira, 7 de janeiro às 14:30/)).toBeInTheDocument()
  })

  it('dia sem horários livres sugere outra data', async () => {
    api.fetchSlots.mockResolvedValue([])
    renderPage()
    fireEvent.click(await screen.findByRole('radio', { name: /Corte/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Hoje' }))
    expect(
      await screen.findByText('Nenhum horário livre neste dia. Tente outra data.'),
    ).toBeInTheDocument()
  })

  it('valida nome e telefone antes de enviar', async () => {
    renderPage()
    await chooseUntilSlot()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }))
    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText(/Informe DDD \+ número/)).toBeInTheDocument()
    expect(api.bookAppointment).not.toHaveBeenCalled()
  })

  it('reserva e mostra o resumo, com foco na confirmação', async () => {
    api.bookAppointment.mockResolvedValue({
      ok: true,
      appointment: {
        id: 'a1',
        starts_at: '2030-01-07T17:30:00Z',
        ends_at: '2030-01-07T18:00:00Z',
        service_name: 'Corte',
        price_cents: 4500,
        status: 'pending',
      },
    })
    renderPage()
    await chooseUntilSlot()
    fireEvent.change(screen.getByLabelText(/Seu nome/), { target: { value: 'Cliente Exemplo' } })
    fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: '11987654321' } })
    expect(screen.getByLabelText(/Telefone/)).toHaveValue('(11) 98765-4321')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }))
    const heading = await screen.findByRole('heading', { name: 'Pedido de agendamento enviado' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('segunda-feira, 7 de janeiro às 14:30')).toBeInTheDocument()
    expect(screen.getByText('Aguardando confirmação')).toBeInTheDocument()
    expect(api.bookAppointment).toHaveBeenCalledWith({
      slug: 'barbearia-exemplo',
      serviceId: 's1',
      professionalId: 'p1',
      startsAt: '2030-01-07T17:30:00Z',
      name: 'Cliente Exemplo',
      phone: '11987654321',
    })
  })

  it('mostra a mensagem do banco quando a reserva é recusada', async () => {
    api.bookAppointment.mockResolvedValue({
      ok: false,
      message: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.',
    })
    renderPage()
    await chooseUntilSlot()
    fireEvent.change(screen.getByLabelText(/Seu nome/), { target: { value: 'Cliente Exemplo' } })
    fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: '11987654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('acabou de ser reservado')
  })

  it('sem serviços liberados explica que o agendamento online está indisponível', async () => {
    api.fetchPublicPage.mockResolvedValue({ ...page, services: [] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Agendamento online indisponível no momento')).toBeInTheDocument(),
    )
  })
})
