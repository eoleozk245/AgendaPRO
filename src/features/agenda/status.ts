import type { BadgeTone } from '../../components/Badge.tsx'

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

export const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  pending: 'warning',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'error',
}

// Espelho das regras do banco (D-009). O banco é quem garante; aqui só decide
// quais botões mostrar.
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return value in TRANSITIONS
}

export function nextStatuses(status: AppointmentStatus): AppointmentStatus[] {
  return TRANSITIONS[status]
}

export function isFinal(status: AppointmentStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/** "Não compareceu" e "Concluído" só fazem sentido depois do horário de início. */
export function availableActions(
  status: AppointmentStatus,
  startsAt: Date,
  now: Date = new Date(),
): AppointmentStatus[] {
  const started = startsAt.getTime() <= now.getTime()
  return nextStatuses(status).filter(
    (next) => started || (next !== 'no_show' && next !== 'completed'),
  )
}
