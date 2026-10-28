// Link do cliente (D-022). O código vai depois do "#": essa parte do endereço
// nunca é enviada ao servidor, então não aparece em logs nem no "Referer".

export function manageBookingPath(slug: string, token: string): string {
  return `/${slug}/meu-agendamento#${token}`
}

/**
 * Lê o código do "#" do endereço. Ignora pontuação colada no fim (comum quando
 * o link é colado numa mensagem). Vazio se não houver um código plausível.
 */
export function tokenFromHash(hash: string): string {
  const token = hash.replace(/^#/, '').replace(/[.,;:!?)\]]+$/, '')
  return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : ''
}
