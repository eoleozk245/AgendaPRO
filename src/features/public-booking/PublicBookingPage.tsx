import { SearchX } from 'lucide-react'
import { useCallback } from 'react'
import { useParams } from 'react-router'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { fetchPublicPage } from './api.ts'
import { BookingFlow } from './BookingFlow.tsx'
import { PublicShell } from './PublicShell.tsx'

export function PublicBookingPage() {
  const { slug = '' } = useParams()
  const load = useCallback(() => fetchPublicPage(slug), [slug])
  const { state, retry } = useAsyncData(load)
  const name = state.status === 'ready' && state.data ? state.data.organization.name : undefined

  return (
    <PublicShell name={name}>
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
          pageTitle
          icon={SearchX}
          title="Página de agendamento não encontrada"
          description="Confira o endereço com o estabelecimento."
        />
      )}
      {state.status === 'ready' && state.data && <BookingFlow page={state.data} />}
    </PublicShell>
  )
}
