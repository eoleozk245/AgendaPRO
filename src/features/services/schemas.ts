import { z } from 'zod'
import { parseReaisToCents } from '../../lib/money.ts'

// Mesmas regras das constraints da tabela services.
export const serviceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(80, 'O nome pode ter no máximo 80 caracteres.'),
  description: z.string().trim().max(500, 'A descrição pode ter no máximo 500 caracteres.'),
  durationMinutes: z.coerce
    .number({ message: 'Informe a duração em minutos.' })
    .int('Use minutos inteiros.')
    .min(5, 'A duração mínima é 5 minutos.')
    .max(480, 'A duração máxima é 8 horas (480 minutos).')
    .refine((value) => value % 5 === 0, 'Use múltiplos de 5 minutos (ex.: 30, 45, 60).'),
  price: z.string().transform((value, ctx) => {
    const cents = parseReaisToCents(value)
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Informe o preço no formato 45,00.' })
      return z.NEVER
    }
    if (cents > 10_000_000) {
      ctx.addIssue({ code: 'custom', message: 'O preço máximo é R$ 100.000,00.' })
      return z.NEVER
    }
    return cents
  }),
  active: z.boolean(),
})

export type ServiceFormInput = z.input<typeof serviceFormSchema>
export type ServiceFormOutput = z.output<typeof serviceFormSchema>
