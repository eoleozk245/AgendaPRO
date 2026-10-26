import { z } from 'zod'
import { isValidPhone, phoneDigits } from '../../lib/phone.ts'

// Mesmas regras das constraints da tabela clients. Coletar só o necessário (LGPD).
export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(120, 'O nome pode ter no máximo 120 caracteres.'),
  phone: z
    .string()
    .transform(phoneDigits)
    .refine(
      (digits) => digits === '' || isValidPhone(digits),
      'Informe DDD + número, ex.: (11) 98765-4321.',
    ),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.email().safeParse(value).success,
      'Informe um e-mail válido.',
    ),
  notes: z.string().trim().max(1000, 'As observações podem ter no máximo 1000 caracteres.'),
})

export type ClientFormInput = z.input<typeof clientFormSchema>
export type ClientFormOutput = z.output<typeof clientFormSchema>
