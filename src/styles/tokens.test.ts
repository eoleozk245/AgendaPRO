// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Confere o contraste dos tokens seguindo a WCAG 2.2 (nível AA):
// 4.5:1 para texto e 3:1 para bordas de campos, foco e limites de componentes.

function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`Bloco ${selector} não encontrado em tokens.css`)
  const body = css.slice(start, css.indexOf('}', start))
  const tokens: Record<string, string> = {}
  for (const match of body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens[match[1]] = match[2]
  }
  return tokens
}

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

const light = readBlock(':root')
const themes = {
  claro: light,
  escuro: { ...light, ...readBlock(":root[data-theme='dark']") },
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [value >> 16, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const TEXT = 4.5
const UI = 3

const pairs: [foreground: string, background: string, minimum: number][] = [
  ['text', 'bg', TEXT],
  ['text', 'surface', TEXT],
  ['text', 'surface-muted', TEXT],
  ['text-secondary', 'bg', TEXT],
  ['text-secondary', 'surface', TEXT],
  ['text-secondary', 'surface-muted', TEXT],
  ['link', 'bg', TEXT],
  ['link', 'surface', TEXT],
  ['text', 'input-bg', TEXT],
  ['on-primary', 'primary', TEXT],
  ['on-primary', 'primary-hover', TEXT],
  ['on-primary', 'primary-active', TEXT],
  ['on-danger', 'danger', TEXT],
  ['on-danger', 'danger-hover', TEXT],
  ['error-text', 'surface', TEXT],
  ['success-text', 'surface', TEXT],
  ['success-text', 'success-bg', TEXT],
  ['error-text', 'error-bg', TEXT],
  ['warning-text', 'warning-bg', TEXT],
  ['info-text', 'info-bg', TEXT],
  ['neutral-text', 'neutral-bg', TEXT],
  ['border-input', 'input-bg', UI],
  ['border-input', 'surface', UI],
  ['focus', 'bg', UI],
  ['focus', 'surface', UI],
  ['primary', 'bg', UI],
  ['primary', 'surface', UI],
  ['error', 'surface', UI],
]

describe.each(Object.entries(themes))('tokens do tema %s', (_name, tokens) => {
  it.each(pairs)('%s sobre %s tem contraste mínimo de %s:1', (fg, bg, minimum) => {
    const foreground = tokens[fg]
    const background = tokens[bg]
    expect(foreground, `token --color-${fg} ausente`).toBeDefined()
    expect(background, `token --color-${bg} ausente`).toBeDefined()
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum)
  })
})
