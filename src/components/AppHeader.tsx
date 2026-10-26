import { CalendarCheck, LogOut } from 'lucide-react'
import { useTheme } from '../lib/useTheme.ts'
import styles from './AppHeader.module.css'
import { Button } from './Button.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

type AppHeaderProps = {
  /** Quando existe, mostra o botão "Sair". */
  onSignOut?: () => void
}

export function AppHeader({ onSignOut }: AppHeaderProps) {
  const { preference, setPreference } = useTheme()

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          <CalendarCheck size={20} />
        </span>
        <span className={styles.name}>AgendaPRO</span>
      </div>
      <div className={styles.actions}>
        <ThemeToggle value={preference} onChange={setPreference} />
        {onSignOut && (
          <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={onSignOut}>
            <span className={styles.signOutLabel}>Sair</span>
          </Button>
        )}
      </div>
    </header>
  )
}
