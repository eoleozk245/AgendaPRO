import { Copy } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button.tsx'
import { TextField } from '../../components/TextField.tsx'
import { formatDayLabel, utcToZoned } from '../../lib/timezone.ts'
import styles from './BookingFlow.module.css'
import { manageBookingPath } from './manage-link.ts'

type Props = {
  slug: string
  token: string
  timeZone: string
  changes: { enabled: boolean; deadline: string }
}

/** Link privado do agendamento, mostrado uma vez só, logo depois da reserva (D-022). */
export function ManageLink({ slug, token, timeZone, changes }: Props) {
  const headingId = useId()
  const path = manageBookingPath(slug, token)
  const url = `${window.location.origin}${path}`
  const [copy, setCopy] = useState<'copiado' | 'falhou'>()
  const deadline = utcToZoned(changes.deadline, timeZone)
  // Calculado uma vez, quando a confirmação aparece.
  const [canChange] = useState(() => changes.enabled && Date.parse(changes.deadline) > Date.now())

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopy('copiado')
    } catch {
      setCopy('falhou')
    }
  }

  return (
    <section className={styles.manage} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.manageTitle}>
        Seu link do agendamento
      </h2>
      <p className={styles.manageText}>
        {canChange
          ? `Por ele você cancela ou remarca até ${formatDayLabel(deadline.date)} às ${deadline.time}.`
          : 'Por ele você acompanha a situação. Para cancelar ou remarcar, fale com o estabelecimento.'}{' '}
        Guarde o link e não compartilhe: quem tiver o link consegue mexer no agendamento.
      </p>
      <TextField
        label="Link"
        value={url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className={styles.manageActions}>
        <Button variant="secondary" size="sm" icon={<Copy size={16} />} onClick={copyLink}>
          Copiar link
        </Button>
        <Link to={path} className={styles.manageOpen}>
          Abrir meu agendamento
        </Link>
      </div>
      <p role="status" className={styles.manageStatus}>
        {copy === 'copiado' && 'Link copiado.'}
        {copy === 'falhou' && 'Não deu para copiar. Selecione o link e copie manualmente.'}
      </p>
    </section>
  )
}
