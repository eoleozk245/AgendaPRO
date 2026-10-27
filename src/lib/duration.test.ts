import { describe, expect, it } from 'vitest'
import { formatDuration } from './duration.ts'

describe('formatDuration', () => {
  it.each([
    [30, '30 min'],
    [60, '1h'],
    [90, '1h 30min'],
    [125, '2h 5min'],
  ])('%i minutos vira "%s"', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })
})
