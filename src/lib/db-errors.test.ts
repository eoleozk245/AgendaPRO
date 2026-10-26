import { describe, expect, it } from 'vitest'
import { dbErrorMessage } from './db-errors.ts'

describe('dbErrorMessage', () => {
  it('usa mensagens padrão por código', () => {
    expect(dbErrorMessage({ code: '23P01' })).toMatch(/conflito/)
  })

  it('aceita mensagem específica por código', () => {
    expect(dbErrorMessage({ code: '23505' }, { '23505': 'Telefone repetido.' })).toBe(
      'Telefone repetido.',
    )
  })

  it('mostra a mensagem das nossas funções (P0001) e esconde as demais', () => {
    expect(dbErrorMessage({ code: 'P0001', message: 'Transição de estado inválida.' })).toBe(
      'Transição de estado inválida.',
    )
    expect(dbErrorMessage({ code: 'XX000', message: 'detalhe interno do servidor' })).not.toMatch(
      /interno/,
    )
  })
})
