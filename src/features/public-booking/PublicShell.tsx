import { CalendarCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { ThemeToggle } from '../../components/ThemeToggle.tsx'
import { useTheme } from '../../lib/useTheme.ts'
import styles from './PublicBookingPage.module.css'

/** Moldura das páginas públicas (sem login): cabeçalho com o nome, conteúdo e rodapé. */
export function PublicShell({ name, children }: { name?: string; children: ReactNode }) {
  const { preference, setPreference } = useTheme()
  return (
    <div className={styles.page}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <CalendarCheck size={20} />
          </span>
          <span className={styles.name}>{name ?? 'Agendamento online'}</span>
        </div>
        <ThemeToggle value={preference} onChange={setPreference} />
      </header>
      <main id="conteudo" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>Agendamento online por AgendaPRO</footer>
    </div>
  )
}
