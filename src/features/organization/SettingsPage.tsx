import { ExternalLink } from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { SelectField } from '../../components/SelectField.tsx'
import { TextField } from '../../components/TextField.tsx'
import type { Professional } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useOrganization } from './organization-context.ts'
import { listProfessionals, renameProfessional, updateOrganization } from './settings-api.ts'
import styles from './SettingsPage.module.css'
import { BRAZIL_TIMEZONES } from './timezones.ts'

const MIN_NOTICE_OPTIONS = [
  { value: 0, label: 'Sem antecedência' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '1 dia' },
  { value: 2880, label: '2 dias' },
]
const MAX_DAYS_OPTIONS = [7, 14, 30, 60, 90]

const nameSchema = z
  .string()
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
  .max(80, 'O nome pode ter no máximo 80 caracteres.')

export function SettingsPage() {
  const { organization, setOrganization } = useOrganization()
  const [name, setName] = useState(organization.name)
  const [timezone, setTimezone] = useState(organization.timezone)
  const [minNotice, setMinNotice] = useState(organization.booking_min_notice_minutes)
  const [maxDays, setMaxDays] = useState(organization.booking_max_days_ahead)
  const [nameError, setNameError] = useState<string>()
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string }>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = nameSchema.safeParse(name)
    if (!parsed.success) {
      setNameError(parsed.error.issues[0].message)
      return
    }
    setNameError(undefined)
    setResult(undefined)
    setSaving(true)
    try {
      setOrganization(
        await updateOrganization(organization.id, {
          name: parsed.data,
          timezone,
          booking_min_notice_minutes: minNotice,
          booking_max_days_ahead: maxDays,
        }),
      )
      setResult({ tone: 'success', text: 'Dados salvos.' })
    } catch (error) {
      setResult({ tone: 'error', text: errorText(error) })
    } finally {
      setSaving(false)
    }
  }

  const timezoneOptions = BRAZIL_TIMEZONES.some((option) => option.value === timezone)
    ? BRAZIL_TIMEZONES
    : [{ value: timezone, label: timezone }, ...BRAZIL_TIMEZONES]

  return (
    <>
      <PageHeader title="Estabelecimento" description="Dados que aparecem para os seus clientes." />
      <div className={styles.sections}>
        <Card>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <h2 className={styles.sectionTitle}>Dados gerais</h2>
            <TextField
              label="Nome do estabelecimento"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={nameError}
            />
            <TextField
              label="Endereço da página de agendamento"
              value={`/${organization.slug}`}
              readOnly
              hint="O endereço não muda depois de criado, para não quebrar links já divulgados."
            />
            <p>
              <Link
                to={`/${organization.slug}`}
                target="_blank"
                rel="noopener"
                className={styles.link}
              >
                Abrir a página de agendamento
                <ExternalLink size={14} aria-hidden="true" />
                <span className="visually-hidden"> (abre em nova aba)</span>
              </Link>
            </p>
            <SelectField
              label="Fuso horário"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              hint="Os horários da agenda e da página pública seguem este fuso."
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <h2 className={styles.sectionTitle}>Regras da página de agendamento</h2>
            <SelectField
              label="Antecedência mínima"
              value={minNotice}
              onChange={(event) => setMinNotice(Number(event.target.value))}
              hint="Clientes não conseguem reservar horários mais próximos que isso."
            >
              {MIN_NOTICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Reservas até"
              value={maxDays}
              onChange={(event) => setMaxDays(Number(event.target.value))}
            >
              {MAX_DAYS_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} dias à frente
                </option>
              ))}
            </SelectField>
            {result && <Alert tone={result.tone} title={result.text} />}
            <div>
              <Button type="submit" loading={saving}>
                Salvar
              </Button>
            </div>
          </form>
        </Card>
        <ProfessionalCard organizationId={organization.id} />
      </div>
    </>
  )
}

function ProfessionalCard({ organizationId }: { organizationId: string }) {
  const load = useCallback(() => listProfessionals(organizationId), [organizationId])
  const { state, retry } = useAsyncData(load)

  return (
    <Card>
      <h2 className={styles.sectionTitle}>Profissional</h2>
      <p className={styles.sectionText}>
        Nome que os clientes veem ao agendar. A gestão de equipe chega depois do MVP.
      </p>
      {state.status === 'loading' && <LoadingState label="Carregando profissional" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível carregar o profissional.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'ready' &&
        state.data.map((professional) => (
          <ProfessionalForm key={professional.id} professional={professional} />
        ))}
    </Card>
  )
}

function ProfessionalForm({ professional }: { professional: Professional }) {
  const [name, setName] = useState(professional.name)
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string }>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = nameSchema.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(undefined)
    setResult(undefined)
    setSaving(true)
    try {
      await renameProfessional(professional.id, parsed.data)
      setResult({ tone: 'success', text: 'Nome do profissional salvo.' })
    } catch (caught) {
      setResult({ tone: 'error', text: errorText(caught) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nome do profissional"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
      />
      {result && <Alert tone={result.tone} title={result.text} />}
      <div>
        <Button type="submit" variant="secondary" loading={saving}>
          Salvar nome
        </Button>
      </div>
    </form>
  )
}
