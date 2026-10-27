import { useId, useState, type FormEvent } from 'react'
import { focusFirstInvalid } from '../../lib/focus.ts'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Checkbox } from '../../components/Checkbox.tsx'
import { Modal } from '../../components/Modal.tsx'
import { TextAreaField } from '../../components/TextAreaField.tsx'
import { TextField } from '../../components/TextField.tsx'
import type { Service } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import { centsToInput } from '../../lib/money.ts'
import { saveService } from './api.ts'
import { serviceFormSchema, type ServiceFormInput } from './schemas.ts'
import styles from './ServiceFormModal.module.css'

type Props = {
  organizationId: string
  /** Serviço em edição; ausente para um novo. */
  service?: Service
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Partial<Record<keyof ServiceFormInput, string>>

function initialValues(service?: Service): ServiceFormInput {
  return {
    name: service?.name ?? '',
    description: service?.description ?? '',
    durationMinutes: String(service?.duration_minutes ?? 30),
    price: service ? centsToInput(service.price_cents) : '',
    active: service?.active ?? true,
  }
}

export function ServiceFormModal({ organizationId, service, onClose, onSaved }: Props) {
  const formId = useId()
  const [values, setValues] = useState<ServiceFormInput>(() => initialValues(service))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function update<K extends keyof ServiceFormInput>(key: K, value: ServiceFormInput[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = serviceFormSchema.safeParse(values)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ServiceFormInput
        next[key] ??= issue.message
      }
      setErrors(next)
      focusFirstInvalid(event.currentTarget)
      return
    }
    setErrors({})
    setFormError(undefined)
    setSaving(true)
    try {
      await saveService(organizationId, parsed.data, service?.id)
      onSaved()
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={service ? 'Editar serviço' : 'Novo serviço'}
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
        <TextField
          label="Nome"
          required
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          error={errors.name}
        />
        <TextAreaField
          label="Descrição"
          hint="Opcional. Aparece na página de agendamento."
          value={values.description}
          onChange={(event) => update('description', event.target.value)}
          error={errors.description}
        />
        <div className={styles.row}>
          <TextField
            label="Duração (minutos)"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            required
            value={String(values.durationMinutes)}
            onChange={(event) => update('durationMinutes', event.target.value)}
            error={errors.durationMinutes}
          />
          <TextField
            label="Preço (R$)"
            inputMode="decimal"
            placeholder="45,00"
            required
            value={values.price}
            onChange={(event) => update('price', event.target.value)}
            error={errors.price}
          />
        </div>
        <Checkbox
          label="Ativo"
          hint="Serviços inativos não aparecem para os clientes."
          checked={values.active}
          onChange={(event) => update('active', event.target.checked)}
        />
        {!service && (
          <p className={styles.note}>
            Toda a equipe passa a fazer este serviço. Para mudar quem faz, edite cada profissional
            em Equipe.
          </p>
        )}
        {formError && <Alert tone="error" title={formError} />}
      </form>
    </Modal>
  )
}
