import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientBooking } from './api.ts'
import { ManageBookingPage } from './ManageBookingPage.tsx'

const api = vi.hoisted(() => ({
  fetchClientBooking: vi.fn(),
  fetchRescheduleSlots: vi.fn(),
  cancelClientBooking: vi.fn(),
  rescheduleClientBooking: vi.fn(),
}))
vi.mock('./api.ts', () => api)

const TOKEN = 'aB3_-xYz0123456789abcdefghijklmnopqrstuvwxy'

// 2030-01-08 é terça-feira. 13:00 UTC = 10:00 em São Paulo.
const booking: ClientBooking = {
  organization: {
    name: 'Barbearia Exemplo',
    slug: 'barbearia-exemplo',
    timezone: 'America/Sao_Paulo',
    max_days_ahead: 30,
  },
  appointment: {
    starts_at: '2030-01-08T13:00:00Z',
    ends_at: '2030-01-08T13:30:00Z',
    status: 'pending',
    service_name: 'Corte',
    duration_minutes: 30,
    price_cents: 4500,
    professional_name: 'Ana Exemplo',
  },
  changes: {
    enabled: true,
    deadline: '2030-01-08T11:00:00Z',
    problem: null,
    reschedules_left: 3,
  },
}

function renderPage(hash = `#${TOKEN}`) {
  return render(
    <MemoryRouter initialEntries={[`/barbearia-exemplo/meu-agendamento${hash}`]}>
      <Routes>
        <Route path="/:slug/meu-agendamento" element={<ManageBookingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ManageBookingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-07T12:00:00Z')) // 09:00 em São Paulo
    for (const fn of Object.values(api)) fn.mockReset()
    api.fetchClientBooking.mockResolvedValue(booking)
  })

  afterEach(() => vi.useRealTimers())

  it('sem código no endereço, avisa que o link é inválido sem consultar o banco', async () => {
    renderPage('')
    expect(await screen.findByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible()
    expect(api.fetchClientBooking).not.toHaveBeenCalled()
  })

  it('código desconhecido mostra link inválido', async () => {
    api.fetchClientBooking.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible()
    expect(api.fetchClientBooking).toHaveBeenCalledWith(TOKEN)
  })

  it('mostra o agendamento, a situação e o prazo no fuso do estabelecimento', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Seu agendamento' })).toBeVisible()
    expect(screen.getByText('Ana Exemplo')).toBeInTheDocument()
    expect(screen.getByText('terça-feira, 8 de janeiro às 10:00')).toBeInTheDocument()
    expect(screen.getByText('Aguardando confirmação')).toBeInTheDocument()
    expect(
      screen.getByText('Você pode cancelar ou remarcar até terça-feira, 8 de janeiro às 08:00.'),
    ).toBeInTheDocument()
  })

  it('cancela depois de confirmar e recarrega a situação', async () => {
    api.cancelClientBooking.mockResolvedValue({ ok: true })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar agendamento' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancelar agendamento' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sim, cancelar' }))
    expect(await screen.findByText(/Agendamento cancelado/)).toBeInTheDocument()
    expect(api.cancelClientBooking).toHaveBeenCalledWith(TOKEN)
    await waitFor(() => expect(api.fetchClientBooking).toHaveBeenCalledTimes(2))
  })

  it('mostra a recusa do banco ao cancelar', async () => {
    api.cancelClientBooking.mockResolvedValue({
      ok: false,
      message: 'O prazo para mudar pelo link já passou. Fale com o estabelecimento.',
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar agendamento' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancelar agendamento' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sim, cancelar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('prazo')
  })

  it('remarca escolhendo dia e horário livres', async () => {
    api.fetchRescheduleSlots.mockResolvedValue(['2030-01-09T17:30:00Z', '2030-01-09T17:45:00Z'])
    api.rescheduleClientBooking.mockResolvedValue({ ok: true })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Remarcar' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Escolha o novo horário' })).toHaveFocus(),
    )
    expect(screen.getByRole('button', { name: 'Confirmar novo horário' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /^\S+ 9 de jan/ }))
    fireEvent.click(await screen.findByRole('radio', { name: '14:30' }))
    expect(api.fetchRescheduleSlots).toHaveBeenCalledWith(TOKEN, '2030-01-09')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }))
    expect(
      await screen.findByText('Horário alterado para quarta-feira, 9 de janeiro às 14:30.'),
    ).toBeInTheDocument()
    expect(api.rescheduleClientBooking).toHaveBeenCalledWith(TOKEN, '2030-01-09T17:30:00Z')
  })

  it('se o horário foi tomado, explica e busca a lista de novo', async () => {
    api.fetchRescheduleSlots.mockResolvedValue(['2030-01-09T17:30:00Z'])
    api.rescheduleClientBooking.mockResolvedValue({
      ok: false,
      message: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.',
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Remarcar' }))
    fireEvent.click(screen.getByRole('radio', { name: /^\S+ 9 de jan/ }))
    fireEvent.click(await screen.findByRole('radio', { name: '14:30' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('reservado por outra pessoa')
    await waitFor(() => expect(api.fetchRescheduleSlots).toHaveBeenCalledTimes(2))
  })

  it('fora do prazo, explica e não oferece mudanças', async () => {
    api.fetchClientBooking.mockResolvedValue({
      ...booking,
      changes: {
        ...booking.changes,
        problem: 'O prazo para mudar pelo link já passou. Fale com o estabelecimento.',
      },
    })
    renderPage()
    expect(await screen.findByText(/O prazo para mudar pelo link já passou/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar agendamento' })).not.toBeInTheDocument()
  })

  it('cancelado mostra a situação e leva a um novo agendamento', async () => {
    api.fetchClientBooking.mockResolvedValue({
      ...booking,
      appointment: { ...booking.appointment, status: 'cancelled' },
      changes: { ...booking.changes, problem: 'Este agendamento já está cancelado.' },
    })
    renderPage()
    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer um novo agendamento' })).toHaveAttribute(
      'href',
      '/barbearia-exemplo',
    )
  })

  it('sem conexão, permite tentar de novo', async () => {
    api.fetchClientBooking.mockRejectedValueOnce(new Error('rede')).mockResolvedValue(booking)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Seu agendamento' })).toBeVisible()
  })

  describe('depois da revisão', () => {
    it('"Pular para o conteúdo" não apaga o código do link', async () => {
      renderPage()
      await screen.findByRole('heading', { level: 1, name: 'Seu agendamento' })
      fireEvent.click(screen.getByRole('link', { name: 'Pular para o conteúdo' }))
      expect(screen.getByRole('main')).toHaveFocus()
      expect(screen.getByRole('heading', { level: 1, name: 'Seu agendamento' })).toBeVisible()
      expect(api.fetchClientBooking).toHaveBeenCalledTimes(1)
    })

    it('recusa do banco atualiza a página (o prazo pode ter vencido)', async () => {
      api.cancelClientBooking.mockResolvedValue({ ok: false, message: 'O prazo passou.' })
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar agendamento' }))
      fireEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
      await waitFor(() => expect(api.fetchClientBooking).toHaveBeenCalledTimes(2))
    })

    it('se a atualização falhar depois de cancelar, o aviso de sucesso continua', async () => {
      api.fetchClientBooking.mockResolvedValueOnce(booking).mockRejectedValue(new Error('rede'))
      api.cancelClientBooking.mockResolvedValue({ ok: true })
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar agendamento' }))
      fireEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
      expect(await screen.findByText('Não foi possível atualizar a situação.')).toBeInTheDocument()
      expect(screen.getByText(/Agendamento cancelado/)).toBeInTheDocument()
      expect(screen.getByText('Ana Exemplo')).toBeInTheDocument()
    })

    it('"Voltar" devolve o foco ao botão Remarcar', async () => {
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Remarcar' }))
      fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Remarcar' })).toHaveFocus())
    })

    it('sem remarcações restantes, só oferece cancelar e explica', async () => {
      api.fetchClientBooking.mockResolvedValue({
        ...booking,
        changes: { ...booking.changes, reschedules_left: 0 },
      })
      renderPage()
      expect(await screen.findByText(/Já não dá para remarcar pelo link/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancelar agendamento' })).toBeInTheDocument()
    })

    it('avisa quando o novo horário já fica dentro do prazo', async () => {
      // Prazo de 2 h; 10:30 de hoje (São Paulo) fica a 1h30 do "agora" do teste.
      api.fetchRescheduleSlots.mockResolvedValue(['2030-01-07T13:30:00Z'])
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Remarcar' }))
      fireEvent.click(screen.getByRole('radio', { name: 'Hoje' }))
      fireEvent.click(await screen.findByRole('radio', { name: '10:30' }))
      expect(screen.getByText('Depois deste, não dá mais para mudar pelo link')).toBeInTheDocument()
    })

    it('trocar de horário apaga o erro anterior', async () => {
      api.fetchRescheduleSlots.mockResolvedValue(['2030-01-09T17:30:00Z', '2030-01-09T17:45:00Z'])
      api.rescheduleClientBooking.mockResolvedValue({ ok: false, message: 'Horário recusado.' })
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Remarcar' }))
      fireEvent.click(screen.getByRole('radio', { name: /^\S+ 9 de jan/ }))
      fireEvent.click(await screen.findByRole('radio', { name: '14:30' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }))
      expect(await screen.findByText('Horário recusado.')).toBeInTheDocument()
      fireEvent.click(await screen.findByRole('radio', { name: '14:45' }))
      expect(screen.queryByText('Horário recusado.')).not.toBeInTheDocument()
    })
  })
})
