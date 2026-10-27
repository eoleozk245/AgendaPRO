import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Checkbox } from '../../components/Checkbox.tsx'
import { Modal } from '../../components/Modal.tsx'
import { TextField } from '../../components/TextField.tsx'
import type { Service } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import {
  createProfessional,
  setProfessionalServices,
  updateProfessional,
  type TeamMember,
} from './api.ts'
import { professionalFormSchema, type ProfessionalFormInput } from './schemas.ts'
import styles from './ProfessionalFormModal.module.css'

type Props = {
  organizationId: string
  /** Profissional em edição; ausente para um novo. */
  professional?: TeamMember
  services: Service[]
  onClose: () => void
  onSaved: () => void
}

function initialValues(services: Service[], professional?: TeamMember): ProfessionalFormInput {
  return {
    name: professional?.name ?? '',
    active: professional?.active ?? true,
    // Novo profissional começa fazendo todos os serviços ativos.
    serviceIds: professional?.serviceIds ?? services.filter((s) => s.active).map((s) => s.id),
  }
}

export function ProfessionalFormModal({
  organizationId,
  professional,
  services,
  onClose,
  onSaved,
}: Props) {
  const formId = useId()
  const [values, setValues] = useState(() => initialValues(services, professional))
  const [nameError, setNameError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  // Salvar um novo são duas etapas (criar e escolher serviços). Se a segunda
  // falhar, "Salvar" de novo atualiza o que já foi criado em vez de duplicar.
  const [createdId, setCreatedId] = useState<string>()

  function toggleService(serviceId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      serviceIds: checked
        ? [...current.serviceIds, serviceId]
        : current.serviceIds.filter((id) => id !== serviceId),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = professionalFormSchema.safeParse(values)
    if (!parsed.success) {
      setNameError(parsed.error.issues[0].message)
      return
    }
    setNameError(undefined)
    setFormError(undefined)
    setSaving(true)
    try {
      let id = professional?.id ?? createdId
      if (id) {
        await updateProfessional(id, parsed.data.name, parsed.data.active)
      } else {
        id = await createProfessional(organizationId, parsed.data.name, parsed.data.active)
        setCreatedId(id)
      }
      await setProfessionalServices(id, parsed.data.serviceIds)
      onSaved()
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={professional ? 'Editar profissional' : 'Novo profissional'}
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
          hint="É o nome que os clientes veem ao agendar."
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          error={nameError}
        />
        <Checkbox
          label="Ativo"
          hint="Inativos não aparecem na página de agendamento. O que já está marcado continua na agenda."
          checked={values.active}
          onChange={(event) => setValues({ ...values, active: event.target.checked })}
        />
        <fieldset className={styles.services}>
          <legend className={styles.legend}>Serviços que faz</legend>
          {services.length === 0 ? (
            <p className={styles.empty}>
              Nenhum serviço cadastrado ainda. Cadastre em{' '}
              <Link to="/painel/servicos">Serviços</Link> e volte aqui.
            </p>
          ) : (
            services.map((service) => (
              <Checkbox
                key={service.id}
                label={service.name}
                hint={service.active ? undefined : 'Serviço inativo: não aparece para os clientes.'}
                checked={values.serviceIds.includes(service.id)}
                onChange={(event) => toggleService(service.id, event.target.checked)}
              />
            ))
          )}
        </fieldset>
        {formError && <Alert tone="error" title={formError} />}
      </form>
    </Modal>
  )
}
