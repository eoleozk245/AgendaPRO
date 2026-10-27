import { Navigate, Outlet, Route, Routes } from 'react-router'
import { AppHeader } from './components/AppHeader.tsx'
import { LoadingState } from './components/LoadingState.tsx'
import { useAuth } from './features/auth/auth-context.ts'
import { AuthScreen } from './features/auth/AuthScreen.tsx'
import { AgendaPage } from './features/agenda/AgendaPage.tsx'
import { BusinessHoursPage } from './features/business-hours/BusinessHoursPage.tsx'
import { ClientsPage } from './features/clients/ClientsPage.tsx'
import { SettingsPage } from './features/organization/SettingsPage.tsx'
import { PanelGate } from './features/panel/PanelGate.tsx'
import { PanelLayout } from './features/panel/PanelLayout.tsx'
import { PublicBookingPage } from './features/public-booking/PublicBookingPage.tsx'
import { ServicesPage } from './features/services/ServicesPage.tsx'
import { TeamPage } from './features/team/TeamPage.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'
import { supabase } from './lib/supabase.ts'
import styles from './App.module.css'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/painel" replace />} />
        <Route path="/entrar" element={<SignInRoute />} />
        <Route path="/painel" element={<PanelGate />}>
          <Route element={<PanelLayout />}>
            <Route index element={<AgendaPage />} />
            <Route path="servicos" element={<ServicesPage />} />
            <Route path="equipe" element={<TeamPage />} />
            <Route path="horarios" element={<BusinessHoursPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="estabelecimento" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* Página pública do estabelecimento: layout próprio, sem login. */}
      <Route path="/:slug" element={<PublicBookingPage />} />
    </Routes>
  )
}

/** Moldura do app (login e painel): cabeçalho com tema e "Sair". */
function AppShell() {
  const auth = useAuth()
  const signedIn = auth.status === 'ready' && auth.session !== null
  return (
    <div className={styles.shell}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <AppHeader onSignOut={signedIn ? () => void supabase.auth.signOut() : undefined} />
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}

function SignInRoute() {
  const auth = useAuth()
  if (auth.status === 'loading') return <LoadingState label="Carregando sua sessão" />
  if (auth.session) return <Navigate to="/painel" replace />
  return (
    <div className={styles.centered}>
      <AuthScreen />
    </div>
  )
}

export default App
