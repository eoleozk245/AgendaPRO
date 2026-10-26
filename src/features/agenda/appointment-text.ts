import { utcToZoned } from '../../lib/timezone.ts'
import type { AgendaAppointment } from './api.ts'

export function appointmentTimes(appointment: AgendaAppointment, timeZone: string) {
  return {
    start: utcToZoned(appointment.starts_at, timeZone).time,
    end: utcToZoned(appointment.ends_at, timeZone).time,
  }
}

export function clientName(appointment: AgendaAppointment): string {
  return appointment.client?.name ?? 'Cliente removido'
}
