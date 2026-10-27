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

// Vidro (D-021): o texto fica sobre uma cor que é a mistura do vidro com o
// fundo. Confere no pior caso: as três manchas do fundo somadas no mesmo ponto
// (mais escuras no tema claro, mais claras no escuro) e o vidro por cima.

type Rgba = [r: number, g: number, b: number, alpha: number]

function readRgba(selector: string): Record<string, Rgba> {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(start, css.indexOf('}', start))
  const tokens: Record<string, Rgba> = {}
  for (const match of body.matchAll(/--([\w-]+):\s*rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)\s*;/g)) {
    const [, name, r, g, b, alpha] = match
    tokens[name] = [Number(r), Number(g), Number(b), Number(alpha) / 100]
  }
  return tokens
}

function blend([r, g, b, alpha]: Rgba, under: string): string {
  const value = Number.parseInt(under.slice(1), 16)
  const base = [value >> 16, (value >> 8) & 255, value & 255]
  const mixed = [r, g, b].map((channel, i) => Math.round(channel * alpha + base[i] * (1 - alpha)))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

const lightGlass = readRgba(':root')
const glassThemes = {
  claro: { colors: themes.claro, glass: lightGlass },
  escuro: {
    colors: themes.escuro,
    glass: { ...lightGlass, ...readRgba(":root[data-theme='dark']") },
  },
}

const onGlass: [foreground: string, minimum: number][] = [
  ['text', TEXT],
  ['text-secondary', TEXT],
  ['link', TEXT],
  ['error-text', TEXT],
  ['success-text', TEXT],
  ['border-input', UI],
  ['focus', UI],
  ['primary', UI],
]

describe.each(Object.entries(glassThemes))('vidro do tema %s', (_name, { colors, glass }) => {
  const backdrop = ['backdrop-1', 'backdrop-2', 'backdrop-3'].reduce(
    (under, name) => blend(glass[name], under),
    colors.bg,
  )

  it.each(['glass-bg', 'glass-bg-strong'])('%s existe com transparência', (layer) => {
    expect(glass[layer], `token --${layer} ausente`).toBeDefined()
    expect(glass[layer][3]).toBeLessThan(1)
  })

  describe.each(['glass-bg', 'glass-bg-strong'])('sobre %s', (layer) => {
    it.each(onGlass)('%s tem contraste mínimo de %s:1', (fg, minimum) => {
      const surface = blend(glass[layer], backdrop)
      expect(contrast(colors[fg], surface)).toBeGreaterThanOrEqual(minimum)
    })
  })
})
