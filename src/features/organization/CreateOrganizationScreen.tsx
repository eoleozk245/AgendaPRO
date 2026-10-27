import { useState, type FormEvent } from 'react'
import { focusFirstInvalid } from '../../lib/focus.ts'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { TextField } from '../../components/TextField.tsx'
import type { Organization } from '../../lib/database.types.ts'
import { createOrganization } from './api.ts'
import { organizationSchema, slugify, type OrganizationFormValues } from './schemas.ts'
import styles from './CreateOrganizationScreen.module.css'

type FieldErrors = Partial<Record<keyof OrganizationFormValues, string>>

export function CreateOrganizationScreen({
  onCreated,
}: {
  onCreated: (organization: Organization) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  // Enquanto a pessoa não mexer no endereço, ele acompanha o nome.
  const [slugEdited, setSlugEdited] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const parsed = organizationSchema.safeParse({ name, slug })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if ((field === 'name' || field === 'slug') && !errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      focusFirstInvalid(form)
      return
    }
    setFieldErrors({})
    setFormError(undefined)
    setSubmitting(true)

    try {
      const result = await createOrganization(parsed.data.name, parsed.data.slug)
      if (result.ok) {
        onCreated(result.organization)
        return
      }
      if (result.field) {
        setFieldErrors({ [result.field]: result.message })
        focusFirstInvalid(form)
      } else {
        setFormError(result.message)
      }
    } catch {
      setFormError('Sem conexão com o servidor. Verifique sua internet e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cadastre seu estabelecimento</h1>
        <p className={styles.subtitle}>
          Esses dados aparecem para os seus clientes na página de agendamento.
        </p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Nome do estabelecimento"
          name="name"
          required
          autoComplete="organization"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (!slugEdited) setSlug(slugify(event.target.value))
          }}
          error={fieldErrors.name}
        />
        <TextField
          label="Endereço da página de agendamento"
          name="slug"
          required
          autoCapitalize="none"
          spellCheck={false}
          value={slug}
          onChange={(event) => {
            setSlugEdited(true)
            setSlug(event.target.value.toLowerCase())
          }}
          hint={`Seu link: agendapro/${slug || 'seu-endereco'}. Não dá para mudar depois.`}
          error={fieldErrors.slug}
        />
        {formError && <Alert tone="error" title={formError} />}
        <Button type="submit" loading={submitting} className={styles.submit}>
          Criar estabelecimento
        </Button>
      </form>
    </Card>
  )
}
