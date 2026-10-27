import { Ban, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import type { AvailabilityBlock } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import {
  addDays,
  formatDayLabel,
  formatShortDate,
  startOfWeek,
  todayIn,
  utcToZoned,
  zonedToUtc,
} from '../../lib/timezone.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useOrganization } from '../organization/organization-context.ts'
import styles from './AgendaPage.module.css'
import { deleteBlock, loadAgenda, loadAgendaReference, type AgendaAppointment } from './api.ts'
import { AppointmentModal } from './AppointmentModal.tsx'
import { BlockModal } from './BlockModal.tsx'
import { DayView } from './DayView.tsx'
import { WeekView } from './WeekView.tsx'

type View = 'day' | 'week'
type Dialog =
  | { kind: 'new' }
  | { kind: 'edit'; appointment: AgendaAppointment }
  | { kind: 'block' }
  | { kind: 'remove-block'; block: AvailabilityBlock }
  | null

export function AgendaPage() {
  const { organization } = useOrganization()
  const timeZone = organization.timezone
  const today = todayIn(timeZone)
  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState(today)
  const [dialog, setDialog] = useState<Dialog>(null)

  const rangeStart = view === 'day' ? date : startOfWeek(date)
  const rangeEnd = addDays(rangeStart, view === 'day' ? 1 : 7)
  const fromIso = zonedToUtc(rangeStart, '00:00', timeZone).toISOString()
  const toIso = zonedToUtc(rangeEnd, '00:00', timeZone).toISOString()

  const loadRange = useCallback(
    () => loadAgenda(organization.id, fromIso, toIso),
    [organization.id, fromIso, toIso],
  )
  const agenda = useAsyncData(loadRange)
  const loadReference = useCallback(() => loadAgendaReference(organization.id), [organization.id])
  const reference = useAsyncData(loadReference)

  const step = view === 'day' ? 1 : 7
  const label =
    view === 'day'
      ? formatDayLabel(date)
      : `${formatShortDate(rangeStart)} a ${formatShortDate(addDays(rangeStart, 6))}`
  const unit = view === 'day' ? 'Dia' : 'Semana'
  const professional =
    reference.state.status === 'ready' ? reference.state.data.professionals[0] : undefined

  function afterChange() {
    setDialog(null)
    agenda.reload()
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`Horários no fuso ${timeZone}.`}
        action={
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              icon={<Ban size={18} />}
              disabled={!professional}
              onClick={() => setDialog({ kind: 'block' })}
            >
              Bloquear horário
            </Button>
            <Button
              icon={<Plus size={18} />}
              disabled={reference.state.status !== 'ready'}
              onClick={() => setDialog({ kind: 'new' })}
            >
              Novo agendamento
            </Button>
          </div>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.navigation}>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${unit} anterior`}
            onClick={() => setDate(addDays(date, -step))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate(today)}
            disabled={date === today}
          >
            Hoje
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${view === 'day' ? 'Próximo dia' : 'Próxima semana'}`}
            onClick={() => setDate(addDays(date, step))}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </Button>
          <h2 className={styles.label} aria-live="polite">
            {label}
          </h2>
        </div>
        <div className={styles.viewSwitch} role="group" aria-label="Visualização">
          <button
            type="button"
            className={styles.viewButton}
            aria-pressed={view === 'day'}
            onClick={() => setView('day')}
          >
            Dia
          </button>
          <button
            type="button"
            className={styles.viewButton}
            aria-pressed={view === 'week'}
            onClick={() => setView('week')}
          >
            Semana
          </button>
        </div>
      </div>

      {(agenda.state.status === 'loading' || reference.state.status === 'loading') && (
        <LoadingState label="Carregando a agenda" />
      )}
      {(agenda.state.status === 'error' || reference.state.status === 'error') && (
        <Alert tone="error" title="Não foi possível carregar a agenda.">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              agenda.retry()
              reference.retry()
            }}
          >
            Tentar de novo
          </Button>
        </Alert>
      )}
      {agenda.state.status === 'ready' && reference.state.status === 'ready' && (
        <>
          {view === 'day' ? (
            <DayView
              date={date}
              timeZone={timeZone}
              hours={reference.state.data.hours}
              appointments={agenda.state.data.appointments}
              blocks={agenda.state.data.blocks}
              nowMinute={date === today ? utcToZoned(new Date(), timeZone).minutesOfDay : undefined}
              onSelect={(appointment) => setDialog({ kind: 'edit', appointment })}
              onRemoveBlock={(block) => setDialog({ kind: 'remove-block', block })}
            />
          ) : (
            <WeekView
              weekStart={rangeStart}
              today={today}
              timeZone={timeZone}
              appointments={agenda.state.data.appointments}
              blocks={agenda.state.data.blocks}
              onSelect={(appointment) => setDialog({ kind: 'edit', appointment })}
              onOpenDay={(day) => {
                setDate(day)
                setView('day')
              }}
            />
          )}
        </>
      )}

      {reference.state.status === 'ready' &&
        (dialog?.kind === 'new' || dialog?.kind === 'edit') && (
          <AppointmentModal
            organizationId={organization.id}
            timeZone={timeZone}
            reference={reference.state.data}
            appointment={dialog.kind === 'edit' ? dialog.appointment : undefined}
            defaultDate={date}
            onClose={() => setDialog(null)}
            onChanged={afterChange}
          />
        )}
      {dialog?.kind === 'block' && professional && (
        <BlockModal
          organizationId={organization.id}
          professionalId={professional.id}
          timeZone={timeZone}
          defaultDate={date}
          onClose={() => setDialog(null)}
          onSaved={afterChange}
        />
      )}
      {dialog?.kind === 'remove-block' && (
        <ConfirmDialog
          title="Remover bloqueio"
          confirmLabel="Remover"
          errorMessage={errorText}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteBlock(dialog.block.id)
            afterChange()
          }}
        >
          <p>O período volta a ficar disponível para agendamentos.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
