import { CalendarClock } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { useOrganization } from '../organization/organization-context.ts'

// Provisório: a agenda de verdade chega na Etapa 4.
export function AgendaPage() {
  const { organization } = useOrganization()
  return (
    <>
      <PageHeader title="Agenda" description={`Link de agendamento: /${organization.slug}`} />
      <EmptyState
        icon={CalendarClock}
        title="A agenda chega na próxima etapa"
        description="Enquanto isso, cadastre serviços e o horário de funcionamento."
      />
    </>
  )
}
