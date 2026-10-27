import { addDays } from '../../lib/timezone.ts'

/** Datas que a página oferece: de hoje até o limite do estabelecimento. */
export function bookableDates(today: string, maxDaysAhead: number): string[] {
  return Array.from({ length: maxDaysAhead + 1 }, (_, index) => addDays(today, index))
}
