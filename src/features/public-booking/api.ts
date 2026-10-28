import { z } from 'zod'
import { supabase } from '../../lib/supabase.ts'

// As funções públicas devolvem JSON livre; o Zod confere o formato antes de usar.
const pageSchema = z.object({
  organization: z.object({
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    min_notice_minutes: z.number(),
    max_days_ahead: z.number(),
  }),
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      duration_minutes: z.number(),
      price_cents: z.number(),
    }),
  ),
  professionals: z.array(
    z.object({ id: z.string(), name: z.string(), service_ids: z.array(z.string()) }),
  ),
})

export type PublicPage = z.infer<typeof pageSchema>
export type PublicService = PublicPage['services'][number]

const bookingResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    appointment: z.object({
      id: z.string(),
      starts_at: z.string(),
      ends_at: z.string(),
      service_name: z.string(),
      price_cents: z.number(),
      status: z.string(),
    }),
    // Código do link do cliente (D-022). Aparece só nesta resposta.
    manage_token: z.string(),
    changes: z.object({ enabled: z.boolean(), deadline: z.string() }),
  }),
  z.object({ ok: z.literal(false), message: z.string() }),
])

export type BookingResult = z.infer<typeof bookingResultSchema>

const NETWORK_ERROR = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'

/** Dados públicos da página. `null` quando o endereço não existe. */
export async function fetchPublicPage(slug: string): Promise<PublicPage | null> {
  const { data, error } = await supabase.rpc('get_public_booking_page', { p_slug: slug })
  if (error) throw new Error(NETWORK_ERROR)
  if (data === null) return null
  return pageSchema.parse(data)
}

export async function fetchSlots(
  slug: string,
  serviceId: string,
  professionalId: string,
  date: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_slug: slug,
    p_service_id: serviceId,
    p_professional_id: professionalId,
    p_date: date,
  })
  if (error) throw new Error(NETWORK_ERROR)
  return (data ?? []).map((row) => row.starts_at)
}

export type BookingInput = {
  slug: string
  serviceId: string
  professionalId: string
  startsAt: string
  name: string
  phone: string
}

export async function bookAppointment(input: BookingInput): Promise<BookingResult> {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_professional_id: input.professionalId,
    p_starts_at: input.startsAt,
    p_client_name: input.name,
    p_client_phone: input.phone,
  })
  if (error) return { ok: false, message: NETWORK_ERROR }
  return bookingResultSchema.parse(data)
}

// ---------------------------------------------------------------------------
// Link do cliente (D-022): ver, cancelar e remarcar sem login.
// ---------------------------------------------------------------------------

const clientBookingSchema = z.object({
  organization: z.object({
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    max_days_ahead: z.number(),
  }),
  appointment: z.object({
    starts_at: z.string(),
    ends_at: z.string(),
    status: z.string(),
    service_name: z.string(),
    duration_minutes: z.number(),
    price_cents: z.number(),
    professional_name: z.string(),
  }),
  changes: z.object({
    enabled: z.boolean(),
    deadline: z.string(),
    /** Por que não dá para mudar pelo link; null quando dá. */
    problem: z.string().nullable(),
    /**
     * Dá para remarcar: além das regras gerais, ainda há remarcações no limite e
     * o profissional ainda faz o serviço. Se não, só cancelar.
     */
    can_reschedule: z.boolean(),
    /** Quantas remarcações pelo link ainda restam (limite por agendamento). */
    reschedules_left: z.number(),
  }),
})

export type ClientBooking = z.infer<typeof clientBookingSchema>

const changeResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), message: z.string() }),
])

export type ChangeResult = z.infer<typeof changeResultSchema>

/** Agendamento do link. `null` quando o código não existe. */
export async function fetchClientBooking(token: string): Promise<ClientBooking | null> {
  const { data, error } = await supabase.rpc('get_client_booking', { p_token: token })
  if (error) throw new Error(NETWORK_ERROR)
  if (data === null) return null
  return clientBookingSchema.parse(data)
}

export async function fetchRescheduleSlots(token: string, date: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_client_reschedule_slots', {
    p_token: token,
    p_date: date,
  })
  if (error) throw new Error(NETWORK_ERROR)
  return (data ?? []).map((row) => row.starts_at)
}

export async function cancelClientBooking(token: string): Promise<ChangeResult> {
  const { data, error } = await supabase.rpc('cancel_client_booking', { p_token: token })
  if (error) return { ok: false, message: NETWORK_ERROR }
  return changeResultSchema.parse(data)
}

export async function rescheduleClientBooking(
  token: string,
  startsAt: string,
): Promise<ChangeResult> {
  const { data, error } = await supabase.rpc('reschedule_client_booking', {
    p_token: token,
    p_starts_at: startsAt,
  })
  if (error) return { ok: false, message: NETWORK_ERROR }
  return changeResultSchema.parse(data)
}
