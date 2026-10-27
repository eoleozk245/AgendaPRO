import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

export const signInSchema = z.object({
  email: z.email({ message: 'Informe um e-mail válido.' }),
  password: z.string().min(1, 'Informe a senha.'),
})

export const signUpSchema = z.object({
  email: z.email({ message: 'Informe um e-mail válido.' }),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(72, 'A senha pode ter no máximo 72 caracteres.'),
})

export type AuthFormValues = z.infer<typeof signInSchema>
export type AuthFieldErrors = Partial<Record<keyof AuthFormValues, string>>

export function fieldErrorsFrom(error: z.ZodError<AuthFormValues>): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if ((field === 'email' || field === 'password') && !errors[field]) {
      errors[field] = issue.message
    }
  }
  return errors
}
