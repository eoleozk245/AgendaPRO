import { describe, expect, it } from 'vitest'
import type { BusinessHour } from '../../lib/database.types.ts'
import { groupByWeekday, shortTime } from './weekdays.ts'

function hour(weekday: number, opens_at: string, closes_at: string): BusinessHour {
  return {
    id: `${weekday}-${opens_at}`,
    organization_id: 'org',
    weekday,
    opens_at,
    closes_at,
    created_at: '',
  }
}

describe('horários', () => {
  it('encurta o horário', () => {
    expect(shortTime('09:30:00')).toBe('09:30')
  })

  it('agrupa por dia e ordena os intervalos', () => {
    const groups = groupByWeekday([
      hour(1, '13:00:00', '18:00:00'),
      hour(1, '09:00:00', '12:00:00'),
      hour(2, '10:00:00', '16:00:00'),
    ])
    expect(groups.get(1)?.map((h) => h.opens_at)).toEqual(['09:00:00', '13:00:00'])
    expect(groups.get(2)).toHaveLength(1)
    expect(groups.get(0)).toBeUndefined()
  })
})
