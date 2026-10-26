import { describe, expect, it } from 'vitest'
import type { Client } from '../../lib/database.types.ts'
import { filterClients } from './filter.ts'

const base = { organization_id: 'org', notes: null, created_at: '', updated_at: '' }
const clients: Client[] = [
  { ...base, id: '1', name: 'José Exemplo', phone: '11987654321', email: null },
  { ...base, id: '2', name: 'Maria Teste', phone: null, email: 'maria@exemplo.test' },
]

describe('filterClients', () => {
  it('busca por nome ignorando acentos e maiúsculas', () => {
    expect(filterClients(clients, 'jose').map((c) => c.id)).toEqual(['1'])
  })

  it('busca por telefone digitado com máscara', () => {
    expect(filterClients(clients, '(11) 98765').map((c) => c.id)).toEqual(['1'])
  })

  it('busca por e-mail e devolve todos com busca vazia', () => {
    expect(filterClients(clients, 'maria@').map((c) => c.id)).toEqual(['2'])
    expect(filterClients(clients, '  ')).toHaveLength(2)
  })
})
