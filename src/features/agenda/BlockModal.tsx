import { useId, useState, type FormEvent } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import { TextField } from '../../components/TextField.tsx'
import { errorText } from '../../lib/db-errors.ts'
import { zonedToUtc } from '../../lib/timezone.ts'
import { createBlock } from './api.ts'
import styles from './AppointmentModal.module.css'

type Props = {
  organizationId: string
  professionalId: string
  timeZone: string
  defaultDate: string
  onClose: () => void
  onSaved: () => void
}

export function BlockModal({
  organizationId,
  professionalId,
  timeZone,
  defaultDate,
  onClose,
  onSaved,
}: Props) {
  const formId = useId()
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('12:00')
  const [endTime, setEndTime] = useState('13:00')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!date || !startTime || !endTime || endTime <= startTime) {
      setError('O fim do bloqueio precisa ser depois do início.')
      return
    }
    if (reason.trim().length > 200) {
      setError('O motivo pode ter no máximo 200 caracteres.')
      return
    }
    setError(undefined)
    setSaving(true)
    try {
      await createBlock(
        organizationId,
        professionalId,
        zonedToUtc(date, startTime, timeZone).toISOString(),
        zonedToUtc(date, endTime, timeZone).toISOString(),
        reason.trim(),
      )
      onSaved()
    } catch (caught) {
      setError(errorText(caught))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title="Bloquear horário"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Bloquear
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        <p>Ninguém consegue agendar no período bloqueado (folga, compromisso, almoço extra).</p>
        <TextField
          label="Data"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className={styles.row}>
          <TextField
            label="Início"
            type="time"
            step={300}
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <TextField
            label="Fim"
            type="time"
            step={300}
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <TextField
          label="Motivo"
          hint="Opcional. Visível só para o estabelecimento."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <Alert tone="error" title={error} />}
      </form>
    </Modal>
  )
}
