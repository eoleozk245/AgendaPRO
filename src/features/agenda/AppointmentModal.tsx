import { Link } from 'react-router'
import { useId, useState, type FormEvent } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Modal } from '../../components/Modal.tsx'
import { SelectField } from '../../components/SelectField.tsx'
import { TextAreaField } from '../../components/TextAreaField.tsx'
import { TextField } from '../../components/TextField.tsx'
import { errorText } from '../../lib/db-errors.ts'
import { formatDuration } from '../../lib/duration.ts'
import { formatCents } from '../../lib/money.ts'
import { formatPhone } from '../../lib/phone.ts'
import {
  minutesToTime,
  timeToMinutes,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from '../../lib/timezone.ts'
import {
  createAppointment,
  setAppointmentStatus,
  updateAppointment,
  type AgendaAppointment,
  type AgendaReference,
} from './api.ts'
import { clientName } from './appointment-text.ts'
import { StatusBadge } from './StatusBadge.tsx'
import styles from './AppointmentModal.module.css'
import { availableActions, isFinal, STATUS_LABEL, type AppointmentStatus } from './status.ts'

type Props = {
  organizationId: string
  timeZone: string
  reference: AgendaReference
  /** Agendamento existente; ausente para um novo. */
  appointment?: AgendaAppointment
  /** Data sugerida para um novo agendamento. */
  defaultDate: string
  /** Profissional sugerido para um novo agendamento (o que está na agenda). */
  defaultProfessionalId: string
  onClose: () => void
  onChanged: () => void
}

const ACTION_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Voltar para pendente',
  confirmed: 'Confirmar',
  completed: 'Marcar como concluído',
  no_show: 'Não compareceu',
  cancelled: 'Cancelar agendamento',
}

export function AppointmentModal({
  organizationId,
  timeZone,
  reference,
  appointment,
  defaultDate,
  defaultProfessionalId,
  onClose,
  onChanged,
}: Props) {
  const formId = useId()
  const start = appointment ? utcToZoned(appointment.starts_at, timeZone) : null
  const professionals = reference.professionals.filter(
    (p) => p.active || p.id === appointment?.professional_id,
  )

  /** Serviços ativos que o profissional faz (D-020), mais o atual do agendamento. */
  function servicesFor(id: string) {
    return reference.services.filter(
      (s) =>
        (s.id === appointment?.service_id && id === appointment.professional_id) ||
        (s.active &&
          reference.links.some((link) => link.professional_id === id && link.service_id === s.id)),
    )
  }

  const initialProfessionalId =
    appointment?.professional_id ??
    (professionals.some((p) => p.id === defaultProfessionalId)
      ? defaultProfessionalId
      : (professionals[0]?.id ?? ''))
  const [clientId, setClientId] = useState(appointment?.client_id ?? '')
  const [professionalId, setProfessionalId] = useState(initialProfessionalId)
  const [serviceId, setServiceId] = useState(
    appointment?.service_id ?? servicesFor(initialProfessionalId)[0]?.id ?? '',
  )
  const [date, setDate] = useState(start?.date ?? defaultDate)
  const [time, setTime] = useState(start?.time ?? '09:00')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const status = appointment?.status
  const final = status ? isFinal(status) : false
  const services = servicesFor(professionalId)
  const service = services.find((s) => s.id === serviceId)
  const professionalName = professionals.find((p) => p.id === professionalId)?.name

  function changeProfessional(id: string) {
    setProfessionalId(id)
    const options = servicesFor(id)
    if (!options.some((s) => s.id === serviceId)) setServiceId(options[0]?.id ?? '')
  }
  const actions =
    appointment && status ? availableActions(status, new Date(appointment.starts_at)) : []

  // Aviso (não bloqueia): o dono pode encaixar fora do expediente.
  const outsideHours = (() => {
    if (!service || !date || !time) return false
    const startMinute = timeToMinutes(time)
    const endMinute = startMinute + service.duration_minutes
    return !reference.hours.some(
      (hour) =>
        hour.weekday === weekdayOf(date) &&
        timeToMinutes(hour.opens_at) <= startMinute &&
        endMinute <= timeToMinutes(hour.closes_at),
    )
  })()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clientId || !serviceId || !professionalId || !date || !time) {
      setError('Escolha cliente, serviço, data e horário.')
      return
    }
    setError(undefined)
    setSaving(true)
    const input = {
      clientId,
      serviceId,
      professionalId,
      startsAt: zonedToUtc(date, time, timeZone).toISOString(),
      notes: notes.trim(),
    }
    try {
      if (appointment) await updateAppointment(appointment.id, input)
      else await createAppointment(organizationId, input)
      onChanged()
    } catch (caught) {
      setError(errorText(caught))
      setSaving(false)
    }
  }

  async function changeStatus(next: AppointmentStatus) {
    if (!appointment) return
    setError(undefined)
    setSaving(true)
    try {
      await setAppointmentStatus(appointment.id, next)
      onChanged()
    } catch (caught) {
      setError(errorText(caught))
      setSaving(false)
    }
  }

  const title = appointment ? (final ? 'Agendamento' : 'Editar agendamento') : 'Novo agendamento'
  const noClients = reference.clients.length === 0
  const noServices = !reference.services.some((s) => s.active)
  const noProfessionals = professionals.length === 0

  if (!appointment && (noClients || noServices || noProfessionals)) {
    return (
      <Modal open title={title} onClose={onClose}>
        <Alert tone="warning" title="Falta cadastro para agendar">
          {noServices && (
            <p>
              Cadastre pelo menos um serviço ativo em <Link to="/painel/servicos">Serviços</Link>.
            </p>
          )}
          {noProfessionals && (
            <p>
              Ative pelo menos um profissional em <Link to="/painel/equipe">Equipe</Link>.
            </p>
          )}
          {noClients && (
            <p>
              Cadastre o cliente em <Link to="/painel/clientes">Clientes</Link>.
            </p>
          )}
        </Alert>
      </Modal>
    )
  }

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        final ? (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Voltar
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {appointment ? 'Salvar alterações' : 'Agendar'}
            </Button>
          </>
        )
      }
    >
      {appointment && status && (
        <div className={styles.summary}>
          <StatusBadge status={status} />
          <dl className={styles.details}>
            <div>
              <dt>Cliente</dt>
              <dd>
                {clientName(appointment)}
                {appointment.client?.phone && ` · ${formatPhone(appointment.client.phone)}`}
              </dd>
            </div>
            <div>
              <dt>Serviço (valores da reserva)</dt>
              <dd>
                {appointment.service_name} · {formatDuration(appointment.duration_minutes)} ·{' '}
                {formatCents(appointment.price_cents)}
              </dd>
            </div>
            <div>
              <dt>Origem</dt>
              <dd>{appointment.source === 'public' ? 'Página de agendamento' : 'Painel'}</dd>
            </div>
          </dl>
        </div>
      )}

      {!final && (
        <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
          <SelectField
            label="Cliente"
            value={clientId}
            required
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Escolha o cliente</option>
            {reference.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.phone ? ` · ${formatPhone(client.phone)}` : ''}
              </option>
            ))}
          </SelectField>
          {professionals.length > 1 && (
            <SelectField
              label="Profissional"
              value={professionalId}
              onChange={(e) => changeProfessional(e.target.value)}
            >
              {professionals.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </SelectField>
          )}
          {services.length > 0 ? (
            <SelectField
              label="Serviço"
              value={serviceId}
              required
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {formatDuration(option.duration_minutes)} ·{' '}
                  {formatCents(option.price_cents)}
                </option>
              ))}
            </SelectField>
          ) : (
            <Alert
              tone="warning"
              title={`${professionalName ?? 'Esse profissional'} não faz nenhum serviço ativo`}
            >
              Escolha os serviços dessa pessoa em <Link to="/painel/equipe">Equipe</Link>.
            </Alert>
          )}
          <div className={styles.row}>
            <TextField
              label="Data"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <TextField
              label="Horário"
              type="time"
              step={300}
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              hint={
                service && time
                  ? `Termina às ${minutesToTime((timeToMinutes(time) + service.duration_minutes) % (24 * 60))}`
                  : undefined
              }
            />
          </div>
          {outsideHours && (
            <Alert tone="warning" title="Fora do horário de funcionamento">
              Dá para salvar mesmo assim. A página pública nunca oferece esse horário.
            </Alert>
          )}
          <TextAreaField
            label="Observações"
            hint="Opcional. Visível só para o estabelecimento."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </form>
      )}

      {error && (
        <div className={styles.error}>
          <Alert tone="error" title={error} />
        </div>
      )}

      {actions.length > 0 && (
        <div className={styles.actions}>
          <h3 className={styles.actionsTitle}>Situação</h3>
          {confirmingCancel ? (
            <div className={styles.confirm}>
              <p>Cancelar este agendamento? O horário fica livre para outra pessoa.</p>
              <div className={styles.actionButtons}>
                <Button variant="secondary" size="sm" onClick={() => setConfirmingCancel(false)}>
                  Não cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={saving}
                  onClick={() => void changeStatus('cancelled')}
                >
                  Sim, cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.actionButtons}>
              {actions.map((next) =>
                next === 'cancelled' ? (
                  <Button
                    key={next}
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingCancel(true)}
                  >
                    {ACTION_LABEL[next]}
                  </Button>
                ) : (
                  <Button
                    key={next}
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => void changeStatus(next)}
                    aria-label={`${ACTION_LABEL[next]} (mudar para ${STATUS_LABEL[next]})`}
                  >
                    {ACTION_LABEL[next]}
                  </Button>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
