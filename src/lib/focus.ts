/**
 * Leva o foco ao primeiro campo com erro (aria-invalid), para quem usa teclado
 * ou leitor de tela não precisar procurar o que corrigir. Espera a tela
 * mostrar os erros antes de focar.
 */
export function focusFirstInvalid(form: HTMLFormElement) {
  setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
}
