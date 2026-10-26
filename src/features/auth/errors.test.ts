import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './errors.ts'

describe('authErrorMessage', () => {
  it('traduz códigos conhecidos', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(
      'E-mail ou senha incorretos.',
    )
  })

  it('trata limite de tentativas pelo status', () => {
    expect(authErrorMessage({ code: undefined, status: 429 })).toMatch(/Muitas tentativas/)
  })

  it('trata falta de conexão e erros desconhecidos sem expor detalhes', () => {
    expect(authErrorMessage({ code: undefined, status: 0 })).toMatch(/Sem conexão/)
    expect(authErrorMessage({ code: 'algo_interno', status: 500 })).toBe(
      'Não foi possível concluir agora. Tente de novo em instantes.',
    )
  })
})
