// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Garante que a Content Security Policy libera exatamente o script de tema do
// index.html. Sem isso, mudar o script quebraria o tema em produção sem aviso.
describe('cabeçalhos de segurança', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')

  it('o hash do script inline no CSP confere com o index.html', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    expect(scripts).toHaveLength(1)
    const hash = createHash('sha256').update(scripts[0]).digest('base64')
    expect(headers).toContain(`'sha256-${hash}'`)
  })

  it('bloqueia o site dentro de iframes e scripts de outros domínios', () => {
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toMatch(/script-src 'self' 'sha256-[^']+';/)
    expect(headers).toContain("object-src 'none'")
  })
})
