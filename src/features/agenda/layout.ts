import type { BusinessHour } from '../../lib/database.types.ts'
import { timeToMinutes } from '../../lib/timezone.ts'

export type MinuteRange = { start: number; end: number }

const DEFAULT_RANGE: MinuteRange = { start: 8 * 60, end: 20 * 60 }

/**
 * Faixa de horas da visão do dia: o horário de funcionamento daquele dia da
 * semana, ampliado para caber qualquer agendamento ou bloqueio fora dele.
 * Arredonda para horas cheias.
 */
export function dayRange(
  hours: BusinessHour[],
  weekday: number,
  items: MinuteRange[],
): MinuteRange {
  const opening = hours.filter((hour) => hour.weekday === weekday)
  const bounds: MinuteRange[] = [
    ...opening.map((hour) => ({
      start: timeToMinutes(hour.opens_at),
      end: timeToMinutes(hour.closes_at),
    })),
    ...items,
  ]
  if (bounds.length === 0) return DEFAULT_RANGE
  const start = Math.min(...bounds.map((b) => b.start))
  const end = Math.max(...bounds.map((b) => b.end))
  return {
    start: Math.max(0, Math.floor(start / 60) * 60),
    end: Math.min(24 * 60, Math.ceil(end / 60) * 60),
  }
}

/** Posição vertical (em minutos a partir do topo) de um item dentro da faixa. */
export function placement(item: MinuteRange, range: MinuteRange) {
  const start = Math.max(item.start, range.start)
  const end = Math.min(item.end, range.end)
  return { top: start - range.start, height: Math.max(end - start, 15) }
}

/** Intervalos fechados do dia, para pintar a área fora do expediente. */
export function closedRanges(
  hours: BusinessHour[],
  weekday: number,
  range: MinuteRange,
): MinuteRange[] {
  const open = hours
    .filter((hour) => hour.weekday === weekday)
    .map((hour) => ({ start: timeToMinutes(hour.opens_at), end: timeToMinutes(hour.closes_at) }))
    .sort((a, b) => a.start - b.start)
  const closed: MinuteRange[] = []
  let cursor = range.start
  for (const interval of open) {
    if (interval.start > cursor) closed.push({ start: cursor, end: interval.start })
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < range.end) closed.push({ start: cursor, end: range.end })
  return closed
}
