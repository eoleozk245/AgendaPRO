import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import type { ThemePreference } from '../lib/theme.ts'
import styles from './ThemeToggle.module.css'

const options: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'system', label: 'Sistema', Icon: Monitor },
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
]

type ThemeToggleProps = {
  value: ThemePreference
  onChange: (value: ThemePreference) => void
}

// Grupo de rádios nativo: setas do teclado e leitores de tela já funcionam sem código extra.
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <fieldset className={styles.group}>
      <legend className="visually-hidden">Tema</legend>
      {options.map(({ value: option, label, Icon }) => (
        <label key={option} className={styles.option}>
          <input
            type="radio"
            name="theme"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className={`visually-hidden ${styles.input}`}
          />
          <span className={styles.face}>
            <Icon size={16} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
