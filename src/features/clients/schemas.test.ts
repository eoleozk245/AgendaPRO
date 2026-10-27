import { describe, expect, it } from 'vitest'
import { clientFormSchema } from './schemas.ts'

const valid = { name: 'Cliente Exemplo', phone: '', email: '', notes: '' }

describe('clientFormSchema', () => {
  it('guarda o telefone só com dígitos', () => {
    expect(clientFormSchema.parse({ ...valid, phone: '(11) 98765-4321' }).phone).toBe('11987654321')
  })

  it('telefone e e-mail são opcionais', () => {
    expect(clientFormSchema.safeParse(valid).success).toBe(true)
  })

  it('recusa telefone sem DDD e e-mail inválido', () => {
    expect(clientFormSchema.safeParse({ ...valid, phone: '98765-4321' }).success).toBe(false)
    expect(clientFormSchema.safeParse({ ...valid, email: 'sem-arroba' }).success).toBe(false)
  })
})
