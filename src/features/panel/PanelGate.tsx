import { Navigate, Outlet } from 'react-router'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { useAuth } from '../auth/auth-context.ts'
import { CreateOrganizationScreen } from '../organization/CreateOrganizationScreen.tsx'
import { OrganizationContext } from '../organization/organization-context.ts'
import { useMyOrganization } from '../organization/useMyOrganization.ts'
import styles from './PanelGate.module.css'

// Porta de entrada do painel: exige login e um estabelecimento cadastrado.
// Esconder a tela não é a proteção real: quem protege os dados é a RLS do banco.
export function PanelGate() {
  const auth = useAuth()
  if (auth.status === 'loading') return <LoadingState label="Carregando sua sessão" />
  if (!auth.session) return <Navigate to="/entrar" replace />
  return <OrganizationLoader key={auth.session.user.id} userId={auth.session.user.id} />
}

function OrganizationLoader({ userId }: { userId: string }) {
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
  if (!state.organization) {
    return (
      <div className={styles.onboarding}>
        <CreateOrganizationScreen onCreated={setOrganization} />
      </div>
    )
  }
  return (
    <OrganizationContext.Provider value={{ organization: state.organization, setOrganization }}>
      <Outlet />
    </OrganizationContext.Provider>
  )
}
