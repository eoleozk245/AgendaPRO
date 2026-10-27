import { describe, expect, it } from 'vitest'
import { professionalFormSchema } from './schemas.ts'

describe('professionalFormSchema', () => {
  it('tira espaços das pontas do nome', () => {
    const parsed = professionalFormSchema.parse({
      name: '  Ana Exemplo ',
      active: true,
      serviceIds: ['s1'],
    })
    expect(parsed.name).toBe('Ana Exemplo')
  })

  it.each([
    ['A', 'pelo menos 2'],
    ['   ', 'pelo menos 2'],
    ['x'.repeat(81), 'no máximo 80'],
  ])('recusa o nome %j', (name, message) => {
    const result = professionalFormSchema.safeParse({ name, active: true, serviceIds: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain(message)
  })
})
