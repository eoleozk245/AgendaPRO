import { describe, expect, it } from 'vitest'
import { serviceFormSchema } from './schemas.ts'

const valid = {
  name: 'Corte',
  description: '',
  durationMinutes: '30',
  price: '45,00',
  active: true,
}

describe('serviceFormSchema', () => {
  it('converte duração e preço (em centavos)', () => {
    const parsed = serviceFormSchema.parse(valid)
    expect(parsed.durationMinutes).toBe(30)
    expect(parsed.price).toBe(4500)
  })

  it.each([
    [{ durationMinutes: '7' }, 'múltiplos de 5'],
    [{ durationMinutes: '0' }, 'mínima'],
    [{ durationMinutes: '500' }, 'máxima'],
    [{ price: '45,123' }, 'formato'],
    [{ price: '100000,01' }, 'máximo'],
    [{ name: 'A' }, 'pelo menos 2'],
  ])('recusa %o', (change, message) => {
    const result = serviceFormSchema.safeParse({ ...valid, ...change })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain(message)
  })
})
