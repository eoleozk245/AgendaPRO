import type {
  AvailabilityBlock,
  BusinessHour,
  Client,
  Professional,
  Service,
} from '../../lib/database.types.ts'
import { throwIfError } from '../../lib/db-errors.ts'
import { supabase } from '../../lib/supabase.ts'
import type { AppointmentStatus } from './status.ts'

const CONFLICT = {
  '23P01': 'Esse horário conflita com outro agendamento ou com um bloqueio. Escolha outro.',
}

export type AgendaAppointment = {
  id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  service_id: string
  service_name: string
  price_cents: number
  duration_minutes: number
  client_id: string | null
  professional_id: string
  notes: string | null
  source: string
  client: { name: string; phone: string | null } | null
}

export type AgendaData = { appointments: AgendaAppointment[]; blocks: AvailabilityBlock[] }

/** Agendamentos e bloqueios que tocam o intervalo [fromIso, toIso). */
export async function loadAgenda(
  organizationId: string,
  fromIso: string,
  toIso: string,
): Promise<AgendaData> {
  const [appointments, blocks] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, starts_at, ends_at, status, service_id, service_name, price_cents, duration_minutes, client_id, professional_id, notes, source, client:clients(name, phone)',
      )
      .eq('organization_id', organizationId)
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso)
      .order('starts_at'),
    supabase
      .from('availability_blocks')
      .select('*')
      .eq('organization_id', organizationId)
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso)
      .order('starts_at'),
  ])
  throwIfError(appointments.error)
  throwIfError(blocks.error)
  return {
    appointments: (appointments.data ?? []) as AgendaAppointment[],
    blocks: blocks.data ?? [],
  }
}

export type AgendaReference = {
  services: Service[]
  clients: Client[]
  professionals: Professional[]
  hours: BusinessHour[]
}

/** Dados de apoio da agenda (mudam pouco). */
export async function loadAgendaReference(organizationId: string): Promise<AgendaReference> {
  const [services, clients, professionals, hours] = await Promise.all([
    supabase.from('services').select('*').eq('organization_id', organizationId).order('name'),
    supabase.from('clients').select('*').eq('organization_id', organizationId).order('name'),
    supabase
      .from('professionals')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at'),
    supabase.from('business_hours').select('*').eq('organization_id', organizationId),
  ])
  throwIfError(services.error)
  throwIfError(clients.error)
  throwIfError(professionals.error)
  throwIfError(hours.error)
  return {
    services: services.data ?? [],
    clients: clients.data ?? [],
    professionals: professionals.data ?? [],
    hours: hours.data ?? [],
  }
}

export type AppointmentInput = {
  professionalId: string
  serviceId: string
  clientId: string
  startsAt: string
  notes: string
}

export async function createAppointment(organizationId: string, input: AppointmentInput) {
  const { error } = await supabase.from('appointments').insert({
    organization_id: organizationId,
    professional_id: input.professionalId,
    service_id: input.serviceId,
    client_id: input.clientId,
    starts_at: input.startsAt,
    notes: input.notes || null,
  })
  throwIfError(error, CONFLICT)
}

export async function updateAppointment(id: string, input: AppointmentInput) {
  const { error } = await supabase
    .from('appointments')
    .update({
      professional_id: input.professionalId,
      service_id: input.serviceId,
      client_id: input.clientId,
      starts_at: input.startsAt,
      notes: input.notes || null,
    })
    .eq('id', id)
  throwIfError(error, CONFLICT)
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
  throwIfError(error, CONFLICT)
}

export async function createBlock(
  organizationId: string,
  professionalId: string,
  startsAt: string,
  endsAt: string,
  reason: string,
) {
  const { error } = await supabase.from('availability_blocks').insert({
    organization_id: organizationId,
    professional_id: professionalId,
    starts_at: startsAt,
    ends_at: endsAt,
    reason: reason || null,
  })
  throwIfError(error, {
    '23P01': 'Já existe agendamento nesse período. Cancele ou remarque antes de bloquear.',
  })
}

export async function deleteBlock(id: string) {
  const { error } = await supabase.from('availability_blocks').delete().eq('id', id)
  throwIfError(error)
}
