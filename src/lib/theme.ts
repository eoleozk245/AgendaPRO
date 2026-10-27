export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

// Mantenha em sincronia com o script inline do index.html, que aplica o tema
// antes da primeira pintura para a tela não "piscar" no tema errado.
export const THEME_STORAGE_KEY = 'agendapro:theme'
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

// O acesso ao localStorage pode lançar erro (navegação privada, cookies
// bloqueados). Nesses casos o tema volta a seguir o sistema.
function getLocalStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function readThemePreference(storage: ReadableStorage | undefined = getLocalStorage()) {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemePreference(
  preference: ThemePreference,
  storage: WritableStorage | undefined = getLocalStorage(),
): void {
  try {
    if (preference === 'system') {
      storage?.removeItem(THEME_STORAGE_KEY)
    } else {
      storage?.setItem(THEME_STORAGE_KEY, preference)
    }
  } catch {
    // Sem armazenamento a preferência vale só para esta visita.
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_MEDIA_QUERY).matches
}

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme
}
