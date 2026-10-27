import { describe, expect, it } from 'vitest'
import { availableActions, isFinal, nextStatuses } from './status.ts'

describe('estados do agendamento (D-009)', () => {
  it('segue o fluxo permitido', () => {
    expect(nextStatuses('pending')).toEqual(['confirmed', 'cancelled'])
    expect(nextStatuses('confirmed')).toEqual(['completed', 'no_show', 'cancelled'])
  })

  it('estados finais não têm saída', () => {
    expect(isFinal('completed')).toBe(true)
    expect(isFinal('cancelled')).toBe(true)
    expect(isFinal('no_show')).toBe(true)
    expect(isFinal('confirmed')).toBe(false)
  })

  it('"concluído" e "não compareceu" só aparecem depois do início', () => {
    const start = new Date('2030-01-07T13:00:00Z')
    expect(availableActions('confirmed', start, new Date('2030-01-07T12:00:00Z'))).toEqual([
      'cancelled',
    ])
    expect(availableActions('confirmed', start, new Date('2030-01-07T13:05:00Z'))).toEqual([
      'completed',
      'no_show',
      'cancelled',
    ])
  })
})
