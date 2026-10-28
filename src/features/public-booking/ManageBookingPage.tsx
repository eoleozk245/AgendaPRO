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
import { bookableDates } from './dates.ts'
import { DatePicker } from './DatePicker.tsx'
import styles from './ManageBookingPage.module.css'
import { tokenFromHash } from './manage-link.ts'
import { PublicShell } from './PublicShell.tsx'
import { SlotPicker } from './SlotPicker.tsx'

// Para o cliente, "pendente" é dito de um jeito mais claro.
const CLIENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

/** Página do link do cliente (D-022): ver, cancelar e remarcar sem login. */
export function ManageBookingPage() {
  const { hash } = useLocation()
  const token = tokenFromHash(hash)
  const load = useCallback(
    () => (token ? fetchClientBooking(token) : Promise.resolve(null)),
    [token],
  )
  const { state, retry, reload } = useAsyncData(load)
  const booking = state.status === 'ready' ? state.data : null

  return (
    <PublicShell name={booking?.organization.name}>
      {state.status === 'loading' && <LoadingState label="Carregando seu agendamento" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível carregar o agendamento.">
          <p>Verifique sua conexão.</p>
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
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
  const [rescheduling, setRescheduling] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [notice, setNotice] = useState<Notice>()
  const noticeRef = useRef<HTMLDivElement>(null)

  // Leva o foco ao aviso de sucesso: leitores de tela anunciam o resultado.
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

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
      {status !== 'cancelled' && !changes.problem && !rescheduling && (
        <>
          <p className={styles.deadline}>
            Você pode cancelar ou remarcar até {formatDayLabel(deadline.date)} às {deadline.time}.
          </p>
          <div className={styles.actions}>
            <Button
              icon={<CalendarClock size={18} />}
              onClick={() => {
                setNotice(undefined)
                setRescheduling(true)
              }}
            >
              Remarcar
            </Button>
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
      {status !== 'cancelled' && !changes.problem && rescheduling && (
        <Reschedule
          token={token}
          booking={booking}
          onBack={() => setRescheduling(false)}
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
            if (!result.ok) throw new UserFacingError(result.message)
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
  onDone,
}: {
  token: string
  booking: ClientBooking
  onBack: () => void
  onDone: (startsAt: string) => void
}) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const timeZone = booking.organization.timezone
  const today = todayIn(timeZone)
  const dates = bookableDates(today, booking.organization.max_days_ahead)
  const [date, setDate] = useState<string>()
  const [startsAt, setStartsAt] = useState<string>()
  // Muda quando um horário é recusado: o seletor recomeça e busca a lista de novo.
  const [slotsVersion, setSlotsVersion] = useState(0)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => headingRef.current?.focus(), [])

  const loadSlots = useCallback(
    () => (date ? fetchRescheduleSlots(token, date) : Promise.resolve([])),
    [token, date],
  )

  async function save() {
    if (!startsAt) return
    setError(undefined)
    setSaving(true)
    const result = await rescheduleClientBooking(token, startsAt)
    if (result.ok) {
      onDone(startsAt)
      return
    }
    setError(result.message)
    setStartsAt(undefined)
    setSlotsVersion((value) => value + 1)
    setSaving(false)
  }

  return (
    <section className={styles.reschedule} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.subtitle}>
        Escolha o novo horário
      </h2>
      <p className={styles.deadline}>
        Mesmo serviço, com {booking.appointment.professional_name}. Só aparecem horários realmente
        livres, no fuso do estabelecimento ({timeZone}).
      </p>
      <DatePicker
        legend="1. Novo dia"
        today={today}
        dates={dates}
        value={date}
        onChange={(option) => {
          setDate(option)
          setStartsAt(undefined)
        }}
      />
      {date && (
        <SlotPicker
          key={`${date}-${slotsVersion}`}
          legend="2. Novo horário"
          timeZone={timeZone}
          load={loadSlots}
          value={startsAt}
          onChange={setStartsAt}
        />
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
