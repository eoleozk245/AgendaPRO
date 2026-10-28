import { describe, expect, it } from 'vitest'
import { manageBookingPath, tokenFromHash } from './manage-link.ts'

const token = 'aB3_-xYz0123456789abcdefghijklmnopqrstuvwxy'

describe('link do cliente', () => {
  it('põe o código depois do # (não vai para o servidor)', () => {
    expect(manageBookingPath('barbearia-exemplo', token)).toBe(
      `/barbearia-exemplo/meu-agendamento#${token}`,
    )
  })

  it('lê o código do #', () => {
    expect(tokenFromHash(`#${token}`)).toBe(token)
  })

  it.each(['.', ',', ').', '!'])('ignora pontuação colada no fim (%j)', (end) => {
    expect(tokenFromHash(`#${token}${end}`)).toBe(token)
  })

  it.each(['', '#', '#curto', `#${token}<script>`, `#${token} `])('recusa %j', (hash) => {
    expect(tokenFromHash(hash)).toBe('')
  })
})
