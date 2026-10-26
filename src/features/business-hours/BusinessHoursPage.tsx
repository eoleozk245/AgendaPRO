import { Plus, X } from 'lucide-react'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { Modal } from '../../components/Modal.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { SelectField } from '../../components/SelectField.tsx'
import { TextField } from '../../components/TextField.tsx'
import { errorText } from '../../lib/db-errors.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useOrganization } from '../organization/organization-context.ts'
import { addBusinessHour, deleteBusinessHour, listBusinessHours } from './api.ts'
import styles from './BusinessHoursPage.module.css'
import { groupByWeekday, shortTime, WEEKDAYS } from './weekdays.ts'

export function BusinessHoursPage() {
  const { organization } = useOrganization()
  const load = useCallback(() => listBusinessHours(organization.id), [organization.id])
  const { state, reload, retry } = useAsyncData(load)
  const [adding, setAdding] = useState<number | null>(null)
  const [removeError, setRemoveError] = useState<string>()

  async function remove(id: string) {
    setRemoveError(undefined)
    try {
      await deleteBusinessHour(id)
      reload()
    } catch (error) {
      setRemoveError(errorText(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Horário de funcionamento"
        description={`Horários no fuso ${organization.timezone}. Use dois intervalos no mesmo dia para a pausa do almoço.`}
      />
      {state.status === 'loading' && <LoadingState label="Carregando horários" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível carregar os horários.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'ready' && (
        <Card className={styles.card}>
          {removeError && <Alert tone="error" title={removeError} />}
          <ul className={styles.days}>
            {WEEKDAYS.map(({ value, label }) => {
              const intervals = groupByWeekday(state.data).get(value) ?? []
              return (
                <li key={value} className={styles.day}>
                  <span className={styles.dayName}>{label}</span>
                  <div className={styles.intervals}>
                    {intervals.length === 0 && <span className={styles.closed}>Fechado</span>}
                    {intervals.map((interval) => (
                      <span key={interval.id} className={styles.interval}>
                        {shortTime(interval.opens_at)} – {shortTime(interval.closes_at)}
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`Remover intervalo: ${label}, ${shortTime(interval.opens_at)} às ${shortTime(interval.closes_at)}`}
                          onClick={() => void remove(interval.id)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plus size={16} />}
                    aria-label={`Adicionar intervalo: ${label}`}
                    onClick={() => setAdding(value)}
                  >
                    Adicionar
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      {adding !== null && (
        <AddIntervalModal
          organizationId={organization.id}
          weekday={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null)
            reload()
          }}
        />
      )}
    </>
  )
}

function AddIntervalModal({
  organizationId,
  weekday: initialWeekday,
  onClose,
  onSaved,
}: {
  organizationId: string
  weekday: number
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const [weekday, setWeekday] = useState(initialWeekday)
  const [opensAt, setOpensAt] = useState('09:00')
  const [closesAt, setClosesAt] = useState('18:00')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!opensAt || !closesAt || closesAt <= opensAt) {
      setError('O horário de fechamento precisa ser depois da abertura.')
      return
    }
    setError(undefined)
    setSaving(true)
    try {
      await addBusinessHour(organizationId, weekday, opensAt, closesAt)
      onSaved()
    } catch (caught) {
      setError(errorText(caught))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title="Adicionar intervalo"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        <SelectField
          label="Dia da semana"
          value={weekday}
          onChange={(event) => setWeekday(Number(event.target.value))}
        >
          {WEEKDAYS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <div className={styles.row}>
          <TextField
            label="Abre às"
            type="time"
            step={300}
            required
            value={opensAt}
            onChange={(event) => setOpensAt(event.target.value)}
          />
          <TextField
            label="Fecha às"
            type="time"
            step={300}
            required
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
          />
        </div>
        {error && <Alert tone="error" title={error} />}
      </form>
    </Modal>
  )
}
