import { CalendarCheck } from 'lucide-react'
import { ThemeToggle } from './components/ThemeToggle.tsx'
import { DesignPreview } from './features/design-preview/DesignPreview.tsx'
import { useTheme } from './lib/useTheme.ts'
import styles from './App.module.css'

function App() {
  const { preference, setPreference } = useTheme()

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <CalendarCheck size={20} />
          </span>
          <span className={styles.name}>AgendaPRO</span>
        </div>
        <ThemeToggle value={preference} onChange={setPreference} />
      </header>
      <main className={styles.main}>
        <DesignPreview />
      </main>
    </div>
  )
}

export default App
