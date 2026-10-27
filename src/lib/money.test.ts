import { describe, expect, it } from 'vitest'
import { centsToInput, formatCents, parseReaisToCents } from './money.ts'

describe('parseReaisToCents', () => {
  it.each([
    ['45', 4500],
    ['45,5', 4550],
    ['45,05', 4505],
    ['0,99', 99],
    ['1.234,56', 123456],
    ['R$ 30,00', 3000],
    ['0', 0],
  ])('"%s" vira %i centavos', (input, cents) => {
    expect(parseReaisToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '45,123', '-10', '45.5', '1,2,3', '12.34'])('recusa "%s"', (input) => {
    expect(parseReaisToCents(input)).toBeNull()
  })

  it('não sofre com erro de arredondamento de float', () => {
    // 0,1 + 0,2 em float dá 0,30000000000000004; aqui é tudo inteiro.
    expect(parseReaisToCents('0,10')! + parseReaisToCents('0,20')!).toBe(30)
    expect(parseReaisToCents('19,99')).toBe(1999)
  })
})

describe('formatação', () => {
  it('formata centavos em reais', () => {
    expect(formatCents(4500).replace(/\s/g, ' ')).toBe('R$ 45,00')
    expect(formatCents(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  })

  it('prepara o valor para o campo de texto', () => {
    expect(centsToInput(4505)).toBe('45,05')
    expect(centsToInput(0)).toBe('0,00')
  })
})
