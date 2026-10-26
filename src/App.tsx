import { CalendarCheck, LogOut } from 'lucide-react'
import { Alert } from './components/Alert.tsx'
import { Button } from './components/Button.tsx'
import { LoadingState } from './components/LoadingState.tsx'
import { ThemeToggle } from './components/ThemeToggle.tsx'
import { useAuth } from './features/auth/auth-context.ts'
import { AuthScreen } from './features/auth/AuthScreen.tsx'
import { CreateOrganizationScreen } from './features/organization/CreateOrganizationScreen.tsx'
import { HomeScreen } from './features/organization/HomeScreen.tsx'
import { useMyOrganization } from './features/organization/useMyOrganization.ts'
import { supabase } from './lib/supabase.ts'
import { useTheme } from './lib/useTheme.ts'
import styles from './App.module.css'

function App() {
  const { preference, setPreference } = useTheme()
  const auth = useAuth()
  const session = auth.status === 'ready' ? auth.session : null

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <CalendarCheck size={20} />
          </span>
          <span className={styles.name}>AgendaPRO</span>
        </div>
        <div className={styles.actions}>
          <ThemeToggle value={preference} onChange={setPreference} />
          {session && (
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut size={16} />}
              onClick={() => void supabase.auth.signOut()}
            >
              <span className={styles.signOutLabel}>Sair</span>
            </Button>
          )}
        </div>
      </header>
      <main className={styles.main}>
        {auth.status === 'loading' ? (
          <LoadingState label="Carregando sua sessão" />
        ) : session ? (
          <SignedIn key={session.user.id} userId={session.user.id} />
        ) : (
          <AuthScreen />
        )}
      </main>
    </div>
  )
}

function SignedIn({ userId }: { userId: string }) {
  const { state, reload, setOrganization } = useMyOrganization(userId)

  if (state.status === 'loading') return <LoadingState label="Carregando o estabelecimento" />
  if (state.status === 'error') {
    return (
      <div className={styles.errorState}>
        <Alert tone="error" title="Não foi possível carregar o estabelecimento.">
          Verifique sua conexão e tente de novo.
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  if (!state.organization) return <CreateOrganizationScreen onCreated={setOrganization} />
  return <HomeScreen organization={state.organization} />
}

export default App
