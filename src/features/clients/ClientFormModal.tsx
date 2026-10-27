import { useId, useState, type FormEvent } from 'react'
import { focusFirstInvalid } from '../../lib/focus.ts'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import { TextAreaField } from '../../components/TextAreaField.tsx'
import { TextField } from '../../components/TextField.tsx'
import type { Client } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import { formatPhone } from '../../lib/phone.ts'
import { saveClient } from './api.ts'
import { clientFormSchema, type ClientFormInput } from './schemas.ts'
import styles from './ClientFormModal.module.css'

type Props = {
  organizationId: string
  client?: Client
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Partial<Record<keyof ClientFormInput, string>>

export function ClientFormModal({ organizationId, client, onClose, onSaved }: Props) {
  const formId = useId()
  const [values, setValues] = useState<ClientFormInput>({
    name: client?.name ?? '',
    phone: client?.phone ? formatPhone(client.phone) : '',
    email: client?.email ?? '',
    notes: client?.notes ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function update(key: keyof ClientFormInput, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = clientFormSchema.safeParse(values)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ClientFormInput
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
      await saveClient(organizationId, parsed.data, client?.id)
      onSaved()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={client ? 'Editar cliente' : 'Novo cliente'}
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
          autoComplete="off"
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          error={errors.name}
        />
        <TextField
          label="Telefone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(11) 98765-4321"
          value={values.phone}
          onChange={(event) => update('phone', formatPhone(event.target.value))}
          error={errors.phone}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="off"
          hint="Opcional."
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email}
        />
        <TextAreaField
          label="Observações"
          hint="Opcional. Evite dados sensíveis (saúde, documentos)."
          value={values.notes}
          onChange={(event) => update('notes', event.target.value)}
          error={errors.notes}
        />
        {formError && <Alert tone="error" title={formError} />}
      </form>
    </Modal>
  )
}
