import type { Client } from '../../lib/database.types.ts'
import { phoneDigits } from '../../lib/phone.ts'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filterClients(clients: Client[], query: string): Client[] {
  const text = normalize(query.trim())
  if (!text) return clients
  const digits = phoneDigits(query)
  return clients.filter(
    (client) =>
      normalize(client.name).includes(text) ||
      (digits.length >= 3 && client.phone?.includes(digits)) ||
      normalize(client.email ?? '').includes(text),
  )
}
