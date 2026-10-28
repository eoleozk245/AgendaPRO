import { CalendarX } from 'lucide-react'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { utcToZoned } from '../../lib/timezone.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import styles from './BookingFlow.module.css'

type Props = {
  legend: string
  timeZone: string
  /** Busca os horários livres (instantes em UTC). Precisa ser estável (useCallback). */
  load: () => Promise<string[]>
  value?: string
  onChange: (startsAt: string) => void
}

/** Escolha do horário entre os livres de um dia, no fuso do estabelecimento. */
export function SlotPicker({ legend, timeZone, load, value, onChange }: Props) {
  const { state, retry } = useAsyncData(load)

  return (
    <fieldset className={styles.step}>
      <legend className={styles.legend}>{legend}</legend>
      {state.status === 'loading' && <LoadingState label="Buscando horários livres" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível buscar os horários.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <div className={styles.noSlots}>
          <CalendarX size={24} aria-hidden="true" />
          <p>Nenhum horário livre neste dia. Tente outra data.</p>
        </div>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className={styles.slots}>
          {state.data.map((slot) => (
            <label key={slot} className={styles.slot}>
              <input
                type="radio"
                name="slot"
                value={slot}
                checked={value === slot}
                onChange={() => onChange(slot)}
                className={`visually-hidden ${styles.radio}`}
              />
              <span className={styles.slotFace}>{utcToZoned(slot, timeZone).time}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
