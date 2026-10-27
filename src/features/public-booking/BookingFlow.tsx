import { CalendarX, CircleCheck, Clock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { focusFirstInvalid } from '../../lib/focus.ts'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { TextField } from '../../components/TextField.tsx'
import { formatDuration } from '../../lib/duration.ts'
import { formatCents } from '../../lib/money.ts'
import { formatPhone, isValidPhone, phoneDigits } from '../../lib/phone.ts'
import { formatDayLabel, todayIn, utcToZoned } from '../../lib/timezone.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { bookAppointment, fetchSlots, type PublicPage } from './api.ts'
import styles from './BookingFlow.module.css'
import { bookableDates } from './dates.ts'

const QUICK_DATES = 14
const dateChip = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

type Booked = {
  startsAt: string
  serviceName: string
  priceCents: number
  durationMinutes: number
  professionalName?: string
}

export function BookingFlow({ page }: { page: PublicPage }) {
  const { organization, services, professionals } = page
  const timeZone = organization.timezone
  const today = todayIn(timeZone)
  const dates = bookableDates(today, organization.max_days_ahead)

  const [serviceId, setServiceId] = useState<string>()
  const [professionalId, setProfessionalId] = useState<string>()
  const [date, setDate] = useState<string>()
  const [startsAt, setStartsAt] = useState<string>()
  const [booked, setBooked] = useState<Booked>()

  const service = services.find((s) => s.id === serviceId)
  const serviceProfessionals = professionals.filter(
    (p) => serviceId && p.service_ids.includes(serviceId),
  )
  const effectiveProfessionalId =
    serviceProfessionals.length === 1 ? serviceProfessionals[0].id : professionalId
  const professionalName = serviceProfessionals.find((p) => p.id === effectiveProfessionalId)?.name

  if (booked) {
    return (
      <BookingSuccess
        booked={booked}
        timeZone={timeZone}
        onRestart={() => {
          setBooked(undefined)
          setStartsAt(undefined)
          setDate(undefined)
          setServiceId(undefined)
        }}
      />
    )
  }

  if (services.length === 0) {
    return (
      <Alert tone="info" title="Agendamento online indisponível no momento">
        Este estabelecimento ainda não liberou serviços para agendar pela internet.
      </Alert>
    )
  }

  return (
    <div className={styles.flow}>
      <div className={styles.intro}>
        <h1 className={styles.title}>Agende seu horário</h1>
        <p className={styles.lead}>
          Horários no fuso do estabelecimento ({timeZone}). Só aparecem horários realmente livres.
        </p>
      </div>

      <fieldset className={styles.step}>
        <legend className={styles.legend}>1. Escolha o serviço</legend>
        <div className={styles.choices}>
          {services.map((option) => (
            <label key={option.id} className={styles.choice}>
              <input
                type="radio"
                name="service"
                value={option.id}
                checked={serviceId === option.id}
                onChange={() => {
                  setServiceId(option.id)
                  setProfessionalId(undefined)
                  setStartsAt(undefined)
                }}
                className={`visually-hidden ${styles.radio}`}
              />
              <span className={styles.choiceBody}>
                <span className={styles.choiceTop}>
                  <span className={styles.choiceTitle}>{option.name}</span>
                  <span className={styles.price}>{formatCents(option.price_cents)}</span>
                </span>
                <span className={styles.meta}>
                  <Clock size={14} aria-hidden="true" /> {formatDuration(option.duration_minutes)}
                </span>
                {option.description && (
                  <span className={styles.description}>{option.description}</span>
                )}
                <CircleCheck className={styles.checkIcon} size={20} aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {service && serviceProfessionals.length > 1 && (
        <fieldset className={styles.step}>
          <legend className={styles.legend}>2. Escolha o profissional</legend>
          <div className={styles.choices}>
            {serviceProfessionals.map((option) => (
              <label key={option.id} className={styles.choice}>
                <input
                  type="radio"
                  name="professional"
                  value={option.id}
                  checked={professionalId === option.id}
                  onChange={() => {
                    setProfessionalId(option.id)
                    setStartsAt(undefined)
                  }}
                  className={`visually-hidden ${styles.radio}`}
                />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceTitle}>{option.name}</span>
                  <CircleCheck className={styles.checkIcon} size={20} aria-hidden="true" />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {service && effectiveProfessionalId && (
        <fieldset className={styles.step}>
          <legend className={styles.legend}>
            {serviceProfessionals.length > 1 ? '3.' : '2.'} Escolha o dia
          </legend>
          {serviceProfessionals.length === 1 && (
            <p className={styles.with}>Com {serviceProfessionals[0].name}</p>
          )}
          <div className={styles.dates}>
            {dates.slice(0, QUICK_DATES).map((option) => (
              <label key={option} className={styles.dateChip}>
                <input
                  type="radio"
                  name="date"
                  value={option}
                  checked={date === option}
                  onChange={() => {
                    setDate(option)
                    setStartsAt(undefined)
                  }}
                  className={`visually-hidden ${styles.radio}`}
                />
                <span className={styles.dateFace}>
                  {option === today ? 'Hoje' : dateChip.format(new Date(`${option}T00:00:00Z`))}
                </span>
              </label>
            ))}
          </div>
          {dates.length > QUICK_DATES && (
            <TextField
              className={styles.otherDate}
              label="Outra data"
              type="date"
              min={today}
              max={dates[dates.length - 1]}
              value={date && !dates.slice(0, QUICK_DATES).includes(date) ? date : ''}
              onChange={(event) => {
                if (dates.includes(event.target.value)) {
                  setDate(event.target.value)
                  setStartsAt(undefined)
                }
              }}
            />
          )}
        </fieldset>
      )}

      {service && effectiveProfessionalId && date && (
        <SlotPicker
          key={`${service.id}-${effectiveProfessionalId}-${date}`}
          slug={organization.slug}
          serviceId={service.id}
          professionalId={effectiveProfessionalId}
          date={date}
          timeZone={timeZone}
          step={serviceProfessionals.length > 1 ? 4 : 3}
          value={startsAt}
          onChange={setStartsAt}
        />
      )}

      {service && effectiveProfessionalId && date && startsAt && (
        <ContactStep
          step={serviceProfessionals.length > 1 ? 5 : 4}
          summary={[
            service.name,
            professionalName && `com ${professionalName}`,
            `${formatDayLabel(date)} às ${utcToZoned(startsAt, timeZone).time}`,
            formatCents(service.price_cents),
          ]
            .filter(Boolean)
            .join(' · ')}
          onSubmit={async (name, phone) => {
            const result = await bookAppointment({
              slug: organization.slug,
              serviceId: service.id,
              professionalId: effectiveProfessionalId,
              startsAt,
              name,
              phone,
            })
            if (result.ok) {
              setBooked({
                startsAt: result.appointment.starts_at,
                serviceName: result.appointment.service_name,
                priceCents: result.appointment.price_cents,
                durationMinutes: service.duration_minutes,
                professionalName,
              })
              return undefined
            }
            return result.message
          }}
        />
      )}
    </div>
  )
}

function SlotPicker({
  slug,
  serviceId,
  professionalId,
  date,
  timeZone,
  step,
  value,
  onChange,
}: {
  slug: string
  serviceId: string
  professionalId: string
  date: string
  timeZone: string
  step: number
  value?: string
  onChange: (startsAt: string) => void
}) {
  const load = useCallback(
    () => fetchSlots(slug, serviceId, professionalId, date),
    [slug, serviceId, professionalId, date],
  )
  const { state, retry } = useAsyncData(load)

  return (
    <fieldset className={styles.step}>
      <legend className={styles.legend}>{step}. Escolha o horário</legend>
      {state.status === 'loading' && <LoadingState label="Buscando horários livres" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível buscar os horários.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className={styles.noSlots}>
          <CalendarX size={24} aria-hidden="true" />
          <p>Nenhum horário livre neste dia. Tente outra data.</p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className={styles.slots}>
          {state.data.map((slot) => (
            <label key={slot} className={styles.slot}>
              <input
                type="radio"
                name="slot"
                value={slot}
                checked={value === slot}
                onChange={() => onChange(slot)}
                className={`visually-hidden ${styles.radio}`}
              />
              <span className={styles.slotFace}>{utcToZoned(slot, timeZone).time}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

function ContactStep({
  step,
  summary,
  onSubmit,
}: {
  step: number
  summary: string
  /** Devolve a mensagem de erro, ou undefined se deu certo. */
  onSubmit: (name: string, phone: string) => Promise<string | undefined>
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: { name?: string; phone?: string } = {}
    if (name.trim().length < 2) next.name = 'Informe seu nome.'
    if (!isValidPhone(phoneDigits(phone)))
      next.phone = 'Informe DDD + número, ex.: (11) 98765-4321.'
    setErrors(next)
    if (next.name || next.phone) {
      focusFirstInvalid(event.currentTarget)
      return
    }
    setFormError(undefined)
    setSending(true)
    const message = await onSubmit(name.trim(), phoneDigits(phone))
    if (message) {
      setFormError(message)
      setSending(false)
    }
  }

  return (
    <form className={styles.step} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.legend}>{step}. Seus dados</h2>
      <p className={styles.summary}>{summary}</p>
      <TextField
        label="Seu nome"
        required
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <TextField
        label="Telefone (WhatsApp)"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required
        placeholder="(11) 98765-4321"
        value={phone}
        onChange={(event) => setPhone(formatPhone(event.target.value))}
        error={errors.phone}
      />
      <p className={styles.privacy}>
        Usamos seu nome e telefone só para este agendamento e para o estabelecimento falar com você
        sobre ele.
      </p>
      {formError && <Alert tone="error" title={formError} />}
      <Button type="submit" loading={sending} className={styles.submit}>
        Confirmar agendamento
      </Button>
    </form>
  )
}

function BookingSuccess({
  booked,
  timeZone,
  onRestart,
}: {
  booked: Booked
  timeZone: string
  onRestart: () => void
}) {
  const start = utcToZoned(booked.startsAt, timeZone)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Leva o foco para a confirmação: leitores de tela anunciam o resultado.
  useEffect(() => headingRef.current?.focus(), [])
  return (
    <Card className={styles.success}>
      <CircleCheck size={40} aria-hidden="true" className={styles.successIcon} />
      <h1 className={styles.title} tabIndex={-1} ref={headingRef}>
        Pedido de agendamento enviado
      </h1>
      <p className={styles.lead}>O estabelecimento vai confirmar. Guarde este resumo.</p>
      <dl className={styles.successDetails}>
        <div>
          <dt>Serviço</dt>
          <dd>{booked.serviceName}</dd>
        </div>
        {booked.professionalName && (
          <div>
            <dt>Profissional</dt>
            <dd>{booked.professionalName}</dd>
          </div>
        )}
        <div>
          <dt>Quando</dt>
          <dd>
            {formatDayLabel(start.date)} às {start.time}
          </dd>
        </div>
        <div>
          <dt>Duração e valor</dt>
          <dd>
            {formatDuration(booked.durationMinutes)} · {formatCents(booked.priceCents)}
          </dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>Aguardando confirmação</dd>
        </div>
      </dl>
      <Button variant="secondary" onClick={onRestart}>
        Fazer outro agendamento
      </Button>
    </Card>
  )
}
