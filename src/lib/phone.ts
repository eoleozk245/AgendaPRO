// Telefone brasileiro guardado só com dígitos: DDD + número (10 ou 11 dígitos).

export function phoneDigits(input: string): string {
  return input.replace(/\D/g, '')
}

export function isValidPhone(digits: string): boolean {
  return /^[0-9]{10,11}$/.test(digits) && !digits.startsWith('0')
}

/** "11987654321" vira "(11) 98765-4321". Formata parcialmente enquanto digita. */
export function formatPhone(input: string): string {
  const d = phoneDigits(input).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  const split = rest.length === 9 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}
