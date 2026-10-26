import { CalendarClock } from 'lucide-react'
import { Card } from '../../components/Card.tsx'
import type { Organization } from '../../lib/database.types.ts'
import styles from './HomeScreen.module.css'

// Painel inicial provisório: a agenda de verdade entra na Etapa 4.
export function HomeScreen({ organization }: { organization: Organization }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{organization.name}</h1>
        <p className={styles.subtitle}>Link de agendamento: agendapro/{organization.slug}</p>
      </div>
      <Card>
        <div className={styles.empty}>
          <CalendarClock size={32} aria-hidden="true" />
          <p className={styles.emptyTitle}>Sua agenda vai aparecer aqui</p>
          <p className={styles.emptyText}>
            O próximo passo é cadastrar serviços e horários de funcionamento.
          </p>
        </div>
      </Card>
    </div>
  )
}
