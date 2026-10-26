import type { AuthError } from '@supabase/supabase-js'

// Mensagens claras para quem usa, sem expor detalhes internos do servidor.
const messages: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  user_already_exists: 'Já existe uma conta com esse e-mail. Tente entrar.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  over_email_send_rate_limit: 'Muitos e-mails enviados. Espere alguns minutos e tente de novo.',
  signup_disabled: 'O cadastro de novas contas está desativado no momento.',
}

export function authErrorMessage(error: Pick<AuthError, 'code' | 'status'>): string {
  if (error.code && messages[error.code]) return messages[error.code]
  if (error.status === 429) return messages.over_request_rate_limit
  if (!error.status) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'
  return 'Não foi possível concluir agora. Tente de novo em instantes.'
}
