import { describe, expect, it } from 'vitest'
import { organizationSchema, slugify } from './schemas.ts'

describe('slugify', () => {
  it('tira acentos, espaços e símbolos', () => {
    expect(slugify('Barbearia do Zé')).toBe('barbearia-do-ze')
    expect(slugify('  Salão & Estética Ãngela!! ')).toBe('salao-estetica-angela')
  })

  it('não deixa hífen no começo nem no fim, mesmo cortando no limite', () => {
    expect(slugify('-- Corte --')).toBe('corte')
    const long = slugify('a'.repeat(39) + ' bcd')
    expect(long.length).toBeLessThanOrEqual(40)
    expect(long.endsWith('-')).toBe(false)
  })
})

describe('organizationSchema', () => {
  it('aceita dados válidos', () => {
    expect(
      organizationSchema.safeParse({ name: 'Barbearia Exemplo', slug: 'barbearia-exemplo' })
        .success,
    ).toBe(true)
  })

  it.each([
    'ab',
    'Com-Maiuscula',
    'com espaco',
    'hifen--duplo',
    '-comeca',
    'termina-',
    'acentuação',
  ])('recusa o endereço "%s"', (slug) => {
    expect(organizationSchema.safeParse({ name: 'Barbearia', slug }).success).toBe(false)
  })
})
