import { Ban, CalendarDays } from 'lucide-react'
import { Badge } from '../../components/Badge.tsx'
import type { AvailabilityBlock } from '../../lib/database.types.ts'
import { addDays, formatDayLabel, utcToZoned } from '../../lib/timezone.ts'
import { appointmentTimes, clientName } from './appointment-text.ts'
import { StatusBadge } from './StatusBadge.tsx'
import type { AgendaAppointment } from './api.ts'
import styles from './WeekView.module.css'

type WeekViewProps = {
  weekStart: string
  today: string
  timeZone: string
  appointments: AgendaAppointment[]
  blocks: AvailabilityBlock[]
  onSelect: (appointment: AgendaAppointment) => void
  onOpenDay: (date: string) => void
}

export function WeekView({
  weekStart,
  today,
  timeZone,
  appointments,
  blocks,
  onSelect,
  onOpenDay,
}: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  return (
    <ol className={styles.days}>
      {days.map((date) => {
        const dayAppointments = appointments.filter(
          (a) => utcToZoned(a.starts_at, timeZone).date === date,
        )
        const dayBlocks = blocks.filter((b) => {
          const start = utcToZoned(b.starts_at, timeZone).date
          const end = utcToZoned(b.ends_at, timeZone).date
          return start <= date && date <= end
        })
        const activeCount = dayAppointments.filter((a) => a.status !== 'cancelled').length
        return (
          <li key={date} className={styles.day}>
            <div className={styles.header}>
              <h3 className={styles.dayTitle}>
                {formatDayLabel(date)}
                {date === today && (
                  <Badge tone="info" icon={<CalendarDays size={14} />}>
                    Hoje
                  </Badge>
                )}
              </h3>
              <button type="button" className={styles.openDay} onClick={() => onOpenDay(date)}>
                Ver dia<span className="visually-hidden"> {formatDayLabel(date)}</span>
              </button>
            </div>
            {dayAppointments.length === 0 && dayBlocks.length === 0 ? (
              <p className={styles.empty}>Nenhum agendamento.</p>
            ) : (
              <ul
                className={styles.items}
                aria-label={`${activeCount} agendamentos em ${formatDayLabel(date)}`}
              >
                {dayBlocks.map((block) => (
                  <li key={block.id} className={styles.block}>
                    <Ban size={14} aria-hidden="true" />
                    Bloqueado {utcToZoned(block.starts_at, timeZone).time}–
                    {utcToZoned(block.ends_at, timeZone).time}
                    {block.reason ? ` · ${block.reason}` : ''}
                  </li>
                ))}
                {dayAppointments.map((appointment) => {
                  const times = appointmentTimes(appointment, timeZone)
                  return (
                    <li key={appointment.id}>
                      <button
                        type="button"
                        className={`${styles.item} ${appointment.status === 'cancelled' ? styles.cancelled : ''}`}
                        onClick={() => onSelect(appointment)}
                      >
                        <span className={styles.time}>
                          {times.start}–{times.end}
                        </span>{' '}
                        <span className={styles.text}>
                          {clientName(appointment)} · {appointment.service_name}
                        </span>{' '}
                        <StatusBadge status={appointment.status} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
