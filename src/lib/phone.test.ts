import { describe, expect, it } from 'vitest'
import { formatPhone, isValidPhone, phoneDigits } from './phone.ts'

describe('telefone', () => {
  it('extrai só os dígitos', () => {
    expect(phoneDigits('(11) 98765-4321')).toBe('11987654321')
  })

  it('valida celular e fixo com DDD', () => {
    expect(isValidPhone('11987654321')).toBe(true)
    expect(isValidPhone('1133334444')).toBe(true)
    expect(isValidPhone('987654321')).toBe(false)
    expect(isValidPhone('011987654321')).toBe(false)
    expect(isValidPhone('0119876543')).toBe(false)
  })

  it('formata celular, fixo e digitação parcial', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    expect(formatPhone('119')).toBe('(11) 9')
    expect(formatPhone('1')).toBe('(1')
    expect(formatPhone('')).toBe('')
  })
})
