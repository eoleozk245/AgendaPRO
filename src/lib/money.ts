// Dinheiro sempre em centavos (inteiro). Nunca ponto flutuante nas contas.

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCents(cents: number): string {
  return formatter.format(cents / 100)
}

/**
 * Converte o texto digitado ("45", "45,5", "1.234,56", "R$ 45,00") em centavos.
 * Faz a conta com texto e inteiros, sem float. Retorna null se for inválido.
 */
export function parseReaisToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/i, '').replace(/\s/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null
  const [reais, centavos = ''] = cleaned.replace(/\./g, '').split(',')
  const value = Number(reais) * 100 + Number(centavos.padEnd(2, '0'))
  return Number.isSafeInteger(value) ? value : null
}

/** Valor em centavos para o campo de texto: 4500 vira "45,00". */
export function centsToInput(cents: number): string {
  const reais = Math.trunc(cents / 100)
  const centavos = String(cents % 100).padStart(2, '0')
  return `${reais},${centavos}`
}
