import { describe, expect, it } from 'vitest'
import {
  addDays,
  formatDayLabel,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from './timezone.ts'

describe('zonedToUtc', () => {
  it('São Paulo (UTC-3) vira UTC somando 3 horas', () => {
    expect(zonedToUtc('2030-01-07', '10:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2030-01-07T13:00:00.000Z',
    )
  })

  it('perto da meia-noite muda o dia em UTC', () => {
    expect(zonedToUtc('2030-01-07', '22:30', 'America/Sao_Paulo').toISOString()).toBe(
      '2030-01-08T01:30:00.000Z',
    )
  })

  it('Manaus (UTC-4) e Noronha (UTC-2)', () => {
    expect(zonedToUtc('2030-01-07', '10:00', 'America/Manaus').toISOString()).toBe(
      '2030-01-07T14:00:00.000Z',
    )
    expect(zonedToUtc('2030-01-07', '10:00', 'America/Noronha').toISOString()).toBe(
      '2030-01-07T12:00:00.000Z',
    )
  })

  it('respeita horário de verão (Nova York, antes e depois da virada)', () => {
    expect(zonedToUtc('2030-03-09', '10:00', 'America/New_York').toISOString()).toBe(
      '2030-03-09T15:00:00.000Z',
    )
    expect(zonedToUtc('2030-03-11', '10:00', 'America/New_York').toISOString()).toBe(
      '2030-03-11T14:00:00.000Z',
    )
  })
})

describe('utcToZoned', () => {
  it('mostra o instante no horário local', () => {
    expect(utcToZoned('2030-01-08T01:30:00Z', 'America/Sao_Paulo')).toEqual({
      date: '2030-01-07',
      time: '22:30',
      minutesOfDay: 22 * 60 + 30,
      weekday: 1,
    })
  })

  it('ida e volta mantém o mesmo horário local', () => {
    const instant = zonedToUtc('2030-06-15', '09:05', 'America/Sao_Paulo')
    expect(utcToZoned(instant, 'America/Sao_Paulo')).toMatchObject({
      date: '2030-06-15',
      time: '09:05',
    })
  })
})

describe('datas de calendário', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01')
    expect(addDays('2030-12-31', 1)).toBe('2031-01-01')
    expect(addDays('2030-03-01', -1)).toBe('2030-02-28')
  })

  it('dia da semana e início da semana (segunda)', () => {
    expect(weekdayOf('2030-01-06')).toBe(0)
    expect(startOfWeek('2030-01-06')).toBe('2029-12-31')
    expect(startOfWeek('2030-01-07')).toBe('2030-01-07')
    expect(startOfWeek('2030-01-12')).toBe('2030-01-07')
  })

  it('formata o dia por extenso em português', () => {
    expect(formatDayLabel('2030-01-07')).toBe('segunda-feira, 7 de janeiro')
  })

  it('converte horas e minutos', () => {
    expect(timeToMinutes('09:30')).toBe(570)
    expect(minutesToTime(570)).toBe('09:30')
  })
})
