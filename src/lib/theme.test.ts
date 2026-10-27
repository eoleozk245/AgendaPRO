import { describe, expect, it } from 'vitest'
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from './theme.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const brokenStorage = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('bloqueado')
  },
  removeItem: () => {
    throw new Error('bloqueado')
  },
}

describe('resolveTheme', () => {
  it('segue o sistema quando a preferência é "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('respeita a escolha manual mesmo com o sistema no modo oposto', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('readThemePreference', () => {
  it('lê a preferência salva', () => {
    expect(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark')
  })

  it('volta para "system" com valor desconhecido, ausente ou armazenamento quebrado', () => {
    expect(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: 'roxo' }))).toBe('system')
    expect(readThemePreference(memoryStorage())).toBe('system')
    expect(readThemePreference(brokenStorage)).toBe('system')
    expect(readThemePreference(undefined)).toBe('system')
  })
})

describe('saveThemePreference', () => {
  it('salva escolhas manuais e apaga a chave ao voltar para "system"', () => {
    const storage = memoryStorage()
    saveThemePreference('dark', storage)
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('dark')
    saveThemePreference('system', storage)
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false)
  })

  it('não quebra a página quando o armazenamento falha', () => {
    expect(() => saveThemePreference('light', brokenStorage)).not.toThrow()
  })
})

describe('applyTheme', () => {
  it('marca o tema no elemento raiz', () => {
    const root = document.createElement('html')
    applyTheme('dark', root)
    expect(root.dataset.theme).toBe('dark')
  })
})
