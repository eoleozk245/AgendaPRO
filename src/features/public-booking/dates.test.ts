import { describe, expect, it } from 'vitest'
import { bookableDates } from './dates.ts'

describe('bookableDates', () => {
  it('vai de hoje até o limite, incluindo os dois extremos', () => {
    expect(bookableDates('2030-01-30', 3)).toEqual([
      '2030-01-30',
      '2030-01-31',
      '2030-02-01',
      '2030-02-02',
    ])
  })
})
