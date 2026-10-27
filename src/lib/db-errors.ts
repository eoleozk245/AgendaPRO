// Traduz códigos de erro do PostgreSQL/Supabase em mensagens para quem usa,
// sem expor detalhes internos.

type DbError = { code?: string | null; message?: string | null } | null | undefined

const defaults: Record<string, string> = {
  '23505': 'Já existe um cadastro com esses dados.',
  '23514': 'Confira os dados e tente de novo.',
  '23503': 'Esse registro está sendo usado e não pode ser apagado.',
  '23P01': 'Esse horário entra em conflito com outro já cadastrado.',
  '42501': 'Você não tem permissão para fazer isso.',
}

export function dbErrorMessage(error: DbError, overrides: Record<string, string> = {}): string {
  const code = error?.code ?? ''
  // P0001 só é lançado pelas nossas funções no banco, com mensagens escritas para quem usa.
  if (code === 'P0001' && error?.message && !overrides[code]) return error.message
  return (
    overrides[code] ?? defaults[code] ?? 'Não foi possível salvar agora. Verifique sua conexão.'
  )
}

/** Erro com mensagem já pronta para mostrar na tela. */
export class UserFacingError extends Error {}

export function throwIfError(error: DbError, overrides?: Record<string, string>): void {
  if (error) throw new UserFacingError(dbErrorMessage(error, overrides))
}

export function errorText(error: unknown): string {
  return error instanceof UserFacingError
    ? error.message
    : 'Algo deu errado. Verifique sua conexão e tente de novo.'
}
