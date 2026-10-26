import { CalendarCheck, SearchX } from 'lucide-react'
import { useCallback } from 'react'
import { useParams } from 'react-router'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { ThemeToggle } from '../../components/ThemeToggle.tsx'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useTheme } from '../../lib/useTheme.ts'
import { fetchPublicPage } from './api.ts'
import { BookingFlow } from './BookingFlow.tsx'
import styles from './PublicBookingPage.module.css'

export function PublicBookingPage() {
  const { slug = '' } = useParams()
  const { preference, setPreference } = useTheme()
  const load = useCallback(() => fetchPublicPage(slug), [slug])
  const { state, retry } = useAsyncData(load)
  const name = state.status === 'ready' && state.data ? state.data.organization.name : undefined

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
        {state.status === 'loading' && <LoadingState label="Carregando a página de agendamento" />}
        {state.status === 'error' && (
          <Alert tone="error" title="Não foi possível carregar a página.">
            <p>Verifique sua conexão.</p>
            <Button variant="secondary" size="sm" onClick={retry}>
              Tentar de novo
            </Button>
          </Alert>
        )}
        {state.status === 'ready' && !state.data && (
          <EmptyState
            icon={SearchX}
            title="Página de agendamento não encontrada"
            description="Confira o endereço com o estabelecimento."
          />
        )}
        {state.status === 'ready' && state.data && <BookingFlow page={state.data} />}
      </main>
      <footer className={styles.footer}>Agendamento online por AgendaPRO</footer>
    </div>
  )
}
