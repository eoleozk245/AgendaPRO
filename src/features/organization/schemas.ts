import { z } from 'zod'

// Mesmas regras do banco (constraints em organizations). O banco é a garantia
// final; aqui é só para avisar antes de enviar.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const SLUG_MIN = 3
export const SLUG_MAX = 40

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(80, 'O nome pode ter no máximo 80 caracteres.'),
  slug: z
    .string()
    .trim()
    .min(SLUG_MIN, `O endereço precisa ter pelo menos ${SLUG_MIN} caracteres.`)
    .max(SLUG_MAX, `O endereço pode ter no máximo ${SLUG_MAX} caracteres.`)
    .regex(SLUG_PATTERN, 'Use só letras minúsculas sem acento, números e hífens.'),
})

export type OrganizationFormValues = z.infer<typeof organizationSchema>

/** Gera um endereço a partir do nome: "Barbearia do Zé" vira "barbearia-do-ze". */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '')
}
