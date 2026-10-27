import { z } from 'zod'

// Mesmas regras da constraint professionals_name_length.
export const professionalFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(80, 'O nome pode ter no máximo 80 caracteres.'),
  active: z.boolean(),
  serviceIds: z.array(z.string()),
})

export type ProfessionalFormInput = z.input<typeof professionalFormSchema>
export type ProfessionalFormOutput = z.output<typeof professionalFormSchema>
