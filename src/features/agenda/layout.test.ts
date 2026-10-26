import { describe, expect, it } from 'vitest'
import type { BusinessHour } from '../../lib/database.types.ts'
import { closedRanges, dayRange, placement } from './layout.ts'

function hour(weekday: number, opens_at: string, closes_at: string): BusinessHour {
  return { id: opens_at, organization_id: 'org', weekday, opens_at, closes_at, created_at: '' }
}

const monday = [hour(1, '09:00:00', '12:00:00'), hour(1, '13:30:00', '18:15:00')]

describe('dayRange', () => {
  it('usa o horário de funcionamento arredondado para horas cheias', () => {
    expect(dayRange(monday, 1, [])).toEqual({ start: 540, end: 19 * 60 })
  })

  it('amplia para caber agendamento fora do expediente', () => {
    expect(dayRange(monday, 1, [{ start: 7 * 60 + 30, end: 8 * 60 }])).toEqual({
      start: 420,
      end: 1140,
    })
  })

  it('dia fechado e sem agendamentos usa 08:00 às 20:00', () => {
    expect(dayRange(monday, 0, [])).toEqual({ start: 480, end: 1200 })
  })
})

describe('placement', () => {
  it('calcula topo e altura em minutos, com altura mínima', () => {
    expect(placement({ start: 600, end: 630 }, { start: 540, end: 1140 })).toEqual({
      top: 60,
      height: 30,
    })
    expect(placement({ start: 600, end: 605 }, { start: 540, end: 1140 })).toEqual({
      top: 60,
      height: 15,
    })
  })
})

describe('closedRanges', () => {
  it('marca antes da abertura, a pausa do almoço e depois do fechamento', () => {
    expect(closedRanges(monday, 1, { start: 480, end: 1200 })).toEqual([
      { start: 480, end: 540 },
      { start: 720, end: 810 },
      { start: 1095, end: 1200 },
    ])
  })
})
