// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Garante que a Content Security Policy da Vercel (vercel.json) libera exatamente
// o script de tema do index.html. Sem isso, mudar o script quebraria o tema em
// produção sem aviso.
type VercelConfig = {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

describe('cabeçalhos de segurança (vercel.json)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const config = JSON.parse(
    readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
  ) as VercelConfig
  const allPages = config.headers.find((entry) => entry.source === '/(.*)')
  const header = (key: string) => allPages?.headers.find((h) => h.key === key)?.value ?? ''
  const csp = header('Content-Security-Policy')

  it('o hash do script inline no CSP confere com o index.html', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    expect(scripts).toHaveLength(1)
    const hash = createHash('sha256').update(scripts[0]).digest('base64')
    expect(csp).toContain(`'sha256-${hash}'`)
  })

  it('bloqueia o site dentro de iframes e scripts de outros domínios', () => {
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toMatch(/script-src 'self' 'sha256-[^']+';/)
    expect(csp).toContain("object-src 'none'")
    expect(header('X-Content-Type-Options')).toBe('nosniff')
  })

  it('todas as rotas caem no index.html (o app é uma SPA com /{slug})', () => {
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' })
  })
})
