import { Ban, Trash2 } from 'lucide-react'
import type { AvailabilityBlock, BusinessHour } from '../../lib/database.types.ts'
import { minutesToTime, utcToZoned, weekdayOf } from '../../lib/timezone.ts'
import { appointmentTimes, clientName } from './appointment-text.ts'
import { StatusBadge } from './StatusBadge.tsx'
import type { AgendaAppointment } from './api.ts'
import styles from './DayView.module.css'
import { closedRanges, dayRange, placement, type MinuteRange } from './layout.ts'
import { STATUS_LABEL } from './status.ts'
import { StatusIcon } from './StatusIcon.tsx'

const PX_PER_MINUTE = 1.4

type DayViewProps = {
  date: string
  timeZone: string
  hours: BusinessHour[]
  appointments: AgendaAppointment[]
  blocks: AvailabilityBlock[]
  /** Minuto atual do dia, se a data mostrada for hoje. */
  nowMinute?: number
  onSelect: (appointment: AgendaAppointment) => void
  onRemoveBlock: (block: AvailabilityBlock) => void
}

/** Recorta um intervalo UTC para os minutos do dia mostrado. */
function minutesWithinDay(
  startIso: string,
  endIso: string,
  date: string,
  timeZone: string,
): MinuteRange {
  const start = utcToZoned(startIso, timeZone)
  const end = utcToZoned(endIso, timeZone)
  return {
    start: start.date < date ? 0 : start.minutesOfDay,
    end: end.date > date ? 24 * 60 : end.minutesOfDay,
  }
}

export function DayView({
  date,
  timeZone,
  hours,
  appointments,
  blocks,
  nowMinute,
  onSelect,
  onRemoveBlock,
}: DayViewProps) {
  const active = appointments.filter((appointment) => appointment.status !== 'cancelled')
  const cancelled = appointments.filter((appointment) => appointment.status === 'cancelled')
  const activeRanges = active.map((a) => ({
    item: a,
    range: minutesWithinDay(a.starts_at, a.ends_at, date, timeZone),
  }))
  const blockRanges = blocks.map((b) => ({
    item: b,
    range: minutesWithinDay(b.starts_at, b.ends_at, date, timeZone),
  }))
  const weekday = weekdayOf(date)
  const range = dayRange(
    hours,
    weekday,
    [...activeRanges, ...blockRanges].map((entry) => entry.range),
  )
  const hourMarks: number[] = []
  for (let minute = range.start; minute <= range.end; minute += 60) hourMarks.push(minute)
  const px = (minutes: number) => `${minutes * PX_PER_MINUTE}px`

  return (
    <div className={styles.wrapper}>
      {active.length === 0 && blocks.length === 0 && (
        <p className={styles.empty}>Nenhum agendamento neste dia.</p>
      )}
      <div className={styles.timeline} style={{ height: px(range.end - range.start) }}>
        {hourMarks.map((minute) => (
          <div key={minute} className={styles.hour} style={{ top: px(minute - range.start) }}>
            <span className={styles.hourLabel}>{minutesToTime(minute)}</span>
          </div>
        ))}
        <div className={styles.track}>
          {closedRanges(hours, weekday, range).map((closed) => (
            <div
              key={closed.start}
              className={styles.closed}
              style={{ top: px(closed.start - range.start), height: px(closed.end - closed.start) }}
              aria-hidden="true"
            />
          ))}
          {nowMinute !== undefined && nowMinute >= range.start && nowMinute <= range.end && (
            <div
              className={styles.now}
              style={{ top: px(nowMinute - range.start) }}
              aria-hidden="true"
            />
          )}
          <ul className={styles.items} aria-label="Agendamentos e bloqueios do dia">
            {blockRanges.map(({ item: block, range: blockRange }) => {
              const place = placement(blockRange, range)
              const start = minutesToTime(blockRange.start === 24 * 60 ? 0 : blockRange.start)
              const end = minutesToTime(blockRange.end === 24 * 60 ? 0 : blockRange.end)
              return (
                <li
                  key={block.id}
                  className={styles.block}
                  style={{ top: px(place.top), height: px(place.height) }}
                >
                  <Ban size={14} aria-hidden="true" />
                  <span className={styles.blockText}>
                    Bloqueado {start}–{end}
                    {block.reason ? ` · ${block.reason}` : ''}
                  </span>
                  <button
                    type="button"
                    className={styles.blockRemove}
                    aria-label={`Remover bloqueio das ${start} às ${end}`}
                    onClick={() => onRemoveBlock(block)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
            {activeRanges.map(({ item: appointment, range: appointmentRange }) => {
              const place = placement(appointmentRange, range)
              const times = appointmentTimes(appointment, timeZone)
              const compact = place.height < 40
              return (
                <li
                  key={appointment.id}
                  style={{ top: px(place.top), height: px(place.height) }}
                  className={styles.slot}
                >
                  <button
                    type="button"
                    className={`${styles.appointment} ${styles[appointment.status]} ${compact ? styles.compact : ''}`}
                    onClick={() => onSelect(appointment)}
                  >
                    <span className={styles.time}>
                      {times.start}–{times.end}
                    </span>{' '}
                    <span className={styles.title}>
                      {clientName(appointment)} · {appointment.service_name}
                    </span>{' '}
                    {compact ? (
                      <span className={styles.compactStatus}>
                        <StatusIcon status={appointment.status} size={14} />
                        <span className="visually-hidden">{STATUS_LABEL[appointment.status]}</span>
                      </span>
                    ) : (
                      <StatusBadge status={appointment.status} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      {cancelled.length > 0 && (
        <div className={styles.cancelled}>
          <h3 className={styles.cancelledTitle}>Cancelados neste dia</h3>
          <ul className={styles.cancelledList}>
            {cancelled.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  className={styles.cancelledItem}
                  onClick={() => onSelect(appointment)}
                >
                  <span>
                    {appointmentTimes(appointment, timeZone).start} · {clientName(appointment)} ·{' '}
                    {appointment.service_name}
                  </span>
                  <StatusBadge status="cancelled" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
