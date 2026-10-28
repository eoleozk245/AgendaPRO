import { CalendarClock, CalendarX2, Link2Off } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Alert } from '../../components/Alert.tsx'
import { Badge } from '../../components/Badge.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { errorText, UserFacingError } from '../../lib/db-errors.ts'
import { formatDuration } from '../../lib/duration.ts'
import { formatCents } from '../../lib/money.ts'
import { formatDayLabel, todayIn, utcToZoned } from '../../lib/timezone.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { isAppointmentStatus, STATUS_TONE, type AppointmentStatus } from '../agenda/status.ts'
import { StatusIcon } from '../agenda/StatusIcon.tsx'
import {
  cancelClientBooking,
  fetchClientBooking,
  fetchRescheduleSlots,
  rescheduleClientBooking,
  type ClientBooking,
} from './api.ts'
import flow from './BookingFlow.module.css'
import { CLIENT_STATUS_LABEL } from './client-status.ts'
import { bookableDates } from './dates.ts'
import { DatePicker } from './DatePicker.tsx'
import styles from './ManageBookingPage.module.css'
import { tokenFromHash } from './manage-link.ts'
import { PublicShell } from './PublicShell.tsx'
import { SlotPicker } from './SlotPicker.tsx'

/** Página do link do cliente (D-022): ver, cancelar e remarcar sem login. */
export function ManageBookingPage() {
  const { hash } = useLocation()
  // Lido uma vez só: se o "#" mudar depois (ex.: um atalho da página), o código não se perde.
  const [token] = useState(() => tokenFromHash(hash))
  const load = useCallback(
    () => (token ? fetchClientBooking(token) : Promise.resolve(null)),
    [token],
  )
  const { state, retry, reload } = useAsyncData(load)

  // Guarda o último agendamento carregado. Se a atualização depois de cancelar ou
  // remarcar falhar, a tela continua mostrando o agendamento (e o aviso de sucesso)
  // em vez de virar só um erro, e a pessoa não fica sem saber se deu certo.
  const [lastBooking, setLastBooking] = useState<ClientBooking | null>(null)
  if (state.status === 'ready' && state.data !== lastBooking) setLastBooking(state.data)
  const booking =
    state.status === 'ready' ? state.data : state.status === 'error' ? lastBooking : null

  return (
    <PublicShell name={booking?.organization.name}>
      {state.status === 'loading' && <LoadingState label="Carregando seu agendamento" />}
      {state.status === 'error' && !booking && (
        <Alert tone="error" title="Não foi possível carregar o agendamento.">
          <p>Verifique sua conexão.</p>
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'error' && booking && (
        <div className={styles.refreshError}>
          <Alert tone="warning" title="Não foi possível atualizar a situação.">
            <p>O que você fez foi enviado. Atualize para ver a situação mais recente.</p>
            <Button variant="secondary" size="sm" onClick={reload}>
              Atualizar
            </Button>
          </Alert>
        </div>
      )}
      {state.status === 'ready' && !booking && (
        <EmptyState
          pageTitle
          icon={Link2Off}
          title="Link inválido"
          description="Confira se o link está completo, igual ao que apareceu quando você agendou. Se não tiver mais o link, fale com o estabelecimento."
        />
      )}
      {booking && <ManageBooking token={token} booking={booking} onChanged={reload} />}
    </PublicShell>
  )
}

type Notice = { tone: 'success' | 'error'; text: string }

function ManageBooking({
  token,
  booking,
  onChanged,
}: {
  token: string
  booking: ClientBooking
  onChanged: () => void
}) {
  const { organization, appointment, changes } = booking
  const timeZone = organization.timezone
  const start = utcToZoned(appointment.starts_at, timeZone)
  const deadline = utcToZoned(changes.deadline, timeZone)
  const status: AppointmentStatus = isAppointmentStatus(appointment.status)
    ? appointment.status
    : 'pending'
  const canChange = status !== 'cancelled' && !changes.problem
  const canReschedule = canChange && changes.reschedules_left > 0
  const [rescheduling, setRescheduling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const noticeRef = useRef<HTMLDivElement>(null)
  const rescheduleButtonRef = useRef<HTMLButtonElement>(null)

  // Leva o foco ao aviso de sucesso: leitores de tela anunciam o resultado.
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  // Se o prazo vencer com a página aberta, atualiza: os botões dão lugar ao aviso.
  useEffect(() => {
    if (!canChange) return
    const wait = Date.parse(changes.deadline) - Date.now()
    if (wait <= 0 || wait > 2 ** 31 - 1) return
    const timer = setTimeout(onChanged, wait + 1000)
    return () => clearTimeout(timer)
  }, [canChange, changes.deadline, onChanged])

  function finished(text: string) {
    setRescheduling(false)
    setNotice({ tone: 'success', text })
    onChanged()
  }

  return (
    <div className={styles.page}>
      <h1 className={flow.title}>Seu agendamento</h1>
      {notice && (
        <div ref={noticeRef} tabIndex={-1} className={styles.notice}>
          <Alert tone={notice.tone} title={notice.text} />
        </div>
      )}

      <Card>
        <dl className={flow.successDetails}>
          <div>
            <dt>Serviço</dt>
            <dd>{appointment.service_name}</dd>
          </div>
          <div>
            <dt>Profissional</dt>
            <dd>{appointment.professional_name}</dd>
          </div>
          <div>
            <dt>Quando</dt>
            <dd>
              {formatDayLabel(start.date)} às {start.time}
            </dd>
          </div>
          <div>
            <dt>Duração e valor</dt>
            <dd>
              {formatDuration(appointment.duration_minutes)} ·{' '}
              {formatCents(appointment.price_cents)}
            </dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>
              <Badge tone={STATUS_TONE[status]} icon={<StatusIcon status={status} size={14} />}>
                {CLIENT_STATUS_LABEL[status]}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      {status === 'cancelled' && (
        <p>
          <Link to={`/${organization.slug}`} className={styles.link}>
            Fazer um novo agendamento
          </Link>
        </p>
      )}
      {status !== 'cancelled' && changes.problem && <Alert tone="info" title={changes.problem} />}
      {canChange && !rescheduling && (
        <>
          <p className={styles.deadline}>
            {canReschedule
              ? `Você pode cancelar ou remarcar até ${formatDayLabel(deadline.date)} às ${deadline.time}.`
              : `Você pode cancelar até ${formatDayLabel(deadline.date)} às ${deadline.time}. Já não dá para remarcar pelo link: para mudar o horário, fale com o estabelecimento.`}
          </p>
          <div className={styles.actions}>
            {canReschedule && (
              <Button
                ref={rescheduleButtonRef}
                icon={<CalendarClock size={18} />}
                onClick={() => {
                  setNotice(undefined)
                  setRescheduling(true)
                }}
              >
                Remarcar
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<CalendarX2 size={18} />}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar agendamento
            </Button>
          </div>
        </>
      )}
      {canReschedule && rescheduling && (
        <Reschedule
          token={token}
          booking={booking}
          onBack={() => {
            setRescheduling(false)
            // Devolve o foco a quem abriu a remarcação (teclado e leitor de tela).
            setTimeout(() => rescheduleButtonRef.current?.focus(), 0)
          }}
          onRefused={onChanged}
          onDone={(startsAt) => {
            const next = utcToZoned(startsAt, timeZone)
            finished(`Horário alterado para ${formatDayLabel(next.date)} às ${next.time}.`)
          }}
        />
      )}

      {confirmingCancel && (
        <ConfirmDialog
          title="Cancelar agendamento"
          confirmLabel="Sim, cancelar"
          errorMessage={errorText}
          onClose={() => setConfirmingCancel(false)}
          onConfirm={async () => {
            const result = await cancelClientBooking(token)
            if (!result.ok) {
              // O prazo pode ter vencido: atualiza a página por trás do aviso.
              onChanged()
              throw new UserFacingError(result.message)
            }
            setConfirmingCancel(false)
            finished('Agendamento cancelado. O horário ficou livre para outra pessoa.')
          }}
        >
          <p>
            Cancelar {appointment.service_name} de {formatDayLabel(start.date)} às {start.time}?
            Depois de cancelado, só com um novo agendamento.
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}

function Reschedule({
  token,
  booking,
  onBack,
  onRefused,
  onDone,
}: {
  token: string
  booking: ClientBooking
  onBack: () => void
  onRefused: () => void
  onDone: (startsAt: string) => void
}) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const timeZone = booking.organization.timezone
  const today = todayIn(timeZone)
  const dates = bookableDates(today, booking.organization.max_days_ahead)
  // Antecedência exigida pelo estabelecimento para mudar pelo link.
  const changeNoticeMs =
    Date.parse(booking.appointment.starts_at) - Date.parse(booking.changes.deadline)
  const [date, setDate] = useState<string>()
  const [startsAt, setStartsAt] = useState<string>()
  const [lateChoice, setLateChoice] = useState(false)
  // Muda quando um horário é recusado: o seletor recomeça e busca a lista de novo.
  const [slotsVersion, setSlotsVersion] = useState(0)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => headingRef.current?.focus(), [])

  const loadSlots = useCallback(
    () => (date ? fetchRescheduleSlots(token, date) : Promise.resolve([])),
    [token, date],
  )

  function chooseSlot(slot: string) {
    setStartsAt(slot)
    setError(undefined)
    // Horário em cima do prazo: depois de remarcar, não dá mais para mudar pelo link.
    setLateChoice(Date.parse(slot) - changeNoticeMs < Date.now())
  }

  async function save() {
    if (!startsAt) return
    setError(undefined)
    setSaving(true)
    try {
      const result = await rescheduleClientBooking(token, startsAt)
      if (result.ok) {
        onDone(startsAt)
        return
      }
      setError(result.message)
      setStartsAt(undefined)
      setLateChoice(false)
      setSlotsVersion((value) => value + 1)
      onRefused()
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.reschedule} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.subtitle}>
        Escolha o novo horário
      </h2>
      <p className={styles.deadline}>
        Mesmo serviço, com {booking.appointment.professional_name}. Só aparecem horários realmente
        livres, no fuso do estabelecimento ({timeZone}).
        {booking.changes.reschedules_left === 1 && ' Esta é a última remarcação pelo link.'}
      </p>
      <DatePicker
        legend="1. Novo dia"
        today={today}
        dates={dates}
        value={date}
        onChange={(option) => {
          setDate(option)
          setStartsAt(undefined)
          setLateChoice(false)
          setError(undefined)
        }}
      />
      {date && (
        <SlotPicker
          key={`${date}-${slotsVersion}`}
          legend="2. Novo horário"
          timeZone={timeZone}
          load={loadSlots}
          value={startsAt}
          onChange={chooseSlot}
        />
      )}
      {lateChoice && (
        <Alert tone="warning" title="Depois deste, não dá mais para mudar pelo link">
          Neste horário o prazo do estabelecimento já terá passado. Se precisar mudar de novo, fale
          com ele.
        </Alert>
      )}
      {error && <Alert tone="error" title={error} />}
      <div className={styles.actions}>
        <Button disabled={!startsAt} loading={saving} onClick={() => void save()}>
          Confirmar novo horário
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </section>
  )
}
