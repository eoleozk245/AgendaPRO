import type { BusinessHour } from '../../lib/database.types.ts'

// 0 = domingo ... 6 = sábado (igual ao banco). A tela começa na segunda.
export const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
] as const

/** "09:00:00" vira "09:00". */
export function shortTime(time: string): string {
  return time.slice(0, 5)
}

export function groupByWeekday(hours: BusinessHour[]): Map<number, BusinessHour[]> {
  const groups = new Map<number, BusinessHour[]>()
  for (const hour of [...hours].sort((a, b) => a.opens_at.localeCompare(b.opens_at))) {
    groups.set(hour.weekday, [...(groups.get(hour.weekday) ?? []), hour])
  }
  return groups
}
