import type { ReactNode } from 'react'
import { TextField } from '../../components/TextField.tsx'
import styles from './BookingFlow.module.css'

const QUICK_DATES = 14
const dateChip = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

type Props = {
  legend: string
  today: string
  /** Datas que podem ser escolhidas, em ordem (de hoje até o limite do estabelecimento). */
  dates: string[]
  value?: string
  onChange: (date: string) => void
  /** Conteúdo logo abaixo do título (ex.: com quem é o horário). */
  children?: ReactNode
}

/** Escolha do dia: atalhos para as próximas 2 semanas e um campo para outra data. */
export function DatePicker({ legend, today, dates, value, onChange, children }: Props) {
  const quick = dates.slice(0, QUICK_DATES)
  return (
    <fieldset className={styles.step}>
      <legend className={styles.legend}>{legend}</legend>
      {children}
      <div className={styles.dates}>
        {quick.map((option) => (
          <label key={option} className={styles.dateChip}>
            <input
              type="radio"
              name="date"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className={`visually-hidden ${styles.radio}`}
            />
            <span className={styles.dateFace}>
              {option === today ? 'Hoje' : dateChip.format(new Date(`${option}T00:00:00Z`))}
            </span>
          </label>
        ))}
      </div>
      {dates.length > QUICK_DATES && (
        <TextField
          className={styles.otherDate}
          label="Outra data"
          type="date"
          min={today}
          max={dates[dates.length - 1]}
          value={value && !quick.includes(value) ? value : ''}
          onChange={(event) => {
            if (dates.includes(event.target.value)) onChange(event.target.value)
          }}
        />
      )}
    </fieldset>
  )
}
