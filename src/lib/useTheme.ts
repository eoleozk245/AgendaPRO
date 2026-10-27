import { useEffect, useState } from 'react'
import {
  applyTheme,
  DARK_MEDIA_QUERY,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  systemPrefersDark,
  type ThemePreference,
} from './theme.ts'

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference())

  useEffect(() => {
    applyTheme(resolveTheme(preference, systemPrefersDark()))

    // Só acompanha o sistema enquanto a preferência for "Sistema".
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(DARK_MEDIA_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      applyTheme(resolveTheme('system', event.matches))
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  function setPreference(next: ThemePreference) {
    saveThemePreference(next)
    setPreferenceState(next)
  }

  return { preference, setPreference }
}
