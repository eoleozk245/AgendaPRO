import { z } from 'zod'

// Só variáveis públicas (VITE_*) chegam ao navegador. Chave secreta nunca entra aqui.
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ message: 'VITE_SUPABASE_URL precisa ser uma URL.' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY está vazia.'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  throw new Error(
    `Configuração ausente ou inválida. Copie .env.example para .env.local e preencha. ` +
      parsed.error.issues.map((issue) => issue.message).join(' '),
  )
}

export const env = parsed.data
