import type { Page, Route } from '@playwright/test'
import { addDays, saoPauloToIso, todayInSaoPaulo } from './dates.ts'

// Simula a API do Supabase do host falso usado no build dos testes.
const API = 'http://127.0.0.1:54321'
// supabase-js guarda a sessão em "sb-<primeira parte do host>-auth-token".
const STORAGE_KEY = 'sb-127-auth-token'

const now = new Date().toISOString()

export const organization = {
  id: 'org-1',
  name: 'Barbearia Exemplo',
  slug: 'barbearia-exemplo',
  timezone: 'America/Sao_Paulo',
  booking_min_notice_minutes: 120,
  booking_max_days_ahead: 60,
  client_changes_enabled: true,
  client_change_min_notice_minutes: 120,
  created_at: now,
  updated_at: now,
}

export const services = [
  {
    id: 's1',
    organization_id: 'org-1',
    name: 'Corte de cabelo',
    description: 'Máquina e tesoura (exemplo).',
    duration_minutes: 30,
    price_cents: 4500,
    active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 's2',
    organization_id: 'org-1',
    name: 'Barba',
    description: null,
    duration_minutes: 20,
    price_cents: 3000,
    active: false,
    created_at: now,
    updated_at: now,
  },
]

const professionals = [
  {
    id: 'p1',
    organization_id: 'org-1',
    name: 'Profissional Exemplo',
    active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'p2',
    organization_id: 'org-1',
    name: 'Profissional Exemplo Dois',
    active: false,
    created_at: now,
    updated_at: now,
  },
]

const professionalServices = [
  { organization_id: 'org-1', professional_id: 'p1', service_id: 's1' },
  { organization_id: 'org-1', professional_id: 'p1', service_id: 's2' },
]

const clients = [
  {
    id: 'c1',
    organization_id: 'org-1',
    name: 'Cliente Exemplo Um',
    phone: '11987654321',
    email: null,
    notes: null,
    created_at: now,
    updated_at: now,
  },
]

function businessHours() {
  return Array.from({ length: 7 }, (_, weekday) => ({
    id: `h${weekday}`,
    organization_id: 'org-1',
    weekday,
    opens_at: '09:00:00',
    closes_at: '18:00:00',
    created_at: now,
  }))
}

function appointment(
  id: string,
  time: string,
  minutes: number,
  status: string,
  client: { name: string; phone: string | null } | null,
) {
  const today = todayInSaoPaulo()
  const startsAt = saoPauloToIso(today, time)
  return {
    id,
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(),
    status,
    service_id: 's1',
    service_name: 'Corte de cabelo',
    price_cents: 4500,
    duration_minutes: minutes,
    client_id: client ? 'c1' : null,
    professional_id: 'p1',
    notes: null,
    source: 'panel',
    client,
  }
}

export function todaysAppointments() {
  return [
    appointment('a1', '09:00', 30, 'completed', { name: 'Cliente Exemplo Um', phone: null }),
    appointment('a2', '10:00', 60, 'confirmed', { name: 'Cliente Exemplo Dois', phone: null }),
    appointment('a3', '14:00', 30, 'pending', null),
    appointment('a4', '15:00', 30, 'cancelled', { name: 'Cliente Exemplo Três', phone: null }),
  ]
}

export const publicPage = {
  organization: {
    name: organization.name,
    slug: organization.slug,
    timezone: organization.timezone,
    min_notice_minutes: 120,
    max_days_ahead: 30,
  },
  services: [
    {
      id: 's1',
      name: 'Corte de cabelo',
      description: 'Máquina e tesoura (exemplo).',
      duration_minutes: 30,
      price_cents: 4500,
    },
  ],
  professionals: [{ id: 'p1', name: 'Profissional Exemplo', service_ids: ['s1'] }],
}

/** Horários livres de amanhã, de 15 em 15 a partir das 09:00. */
export function tomorrowSlots(): string[] {
  const tomorrow = addDays(todayInSaoPaulo(), 1)
  return ['09:00', '09:15', '09:30', '10:30', '10:45', '14:00'].map((time) =>
    saoPauloToIso(tomorrow, time),
  )
}

/** Código do link do cliente que o mock reconhece (fictício). */
export const MANAGE_TOKEN = 'e2eToken0123456789abcdefghijklmnopqrstuvwxy'

/** O que o link do cliente mostra: reserva de amanhã às 09:00, ainda pendente. */
function clientBooking() {
  const [startsAt] = tomorrowSlots()
  return {
    organization: {
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      max_days_ahead: 30,
    },
    appointment: {
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + 30 * 60_000).toISOString(),
      status: 'pending',
      service_name: 'Corte de cabelo',
      duration_minutes: 30,
      price_cents: 4500,
      professional_name: 'Profissional Exemplo',
    },
    changes: {
      enabled: true,
      deadline: new Date(Date.parse(startsAt) - 120 * 60_000).toISOString(),
      problem: null,
    },
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/** Responde objeto quando o cliente pede um registro só (maybeSingle/single). */
function rows(route: Route, data: unknown[]) {
  const accept = route.request().headers()['accept'] ?? ''
  return json(route, accept.includes('vnd.pgrst.object') ? (data[0] ?? null) : data)
}

type MockOptions = {
  /** Resposta de get_public_booking_page; null = estabelecimento não existe. */
  page?: typeof publicPage | null
}

/** Liga as rotas simuladas. Tudo que não estiver previsto falha alto. */
export async function mockSupabase(page: Page, options: MockOptions = {}) {
  const publicData = options.page === undefined ? publicPage : options.page

  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path === '/auth/v1/token') {
      return json(
        route,
        {
          code: 'invalid_credentials',
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        },
        400,
      )
    }
    if (path === '/auth/v1/user') return json(route, sessionUser)
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 })

    if (path === '/rest/v1/rpc/get_public_booking_page') return json(route, publicData)
    if (path === '/rest/v1/rpc/get_available_slots') {
      return json(
        route,
        tomorrowSlots().map((startsAt) => ({ starts_at: startsAt })),
      )
    }
    if (path === '/rest/v1/rpc/set_professional_services') return route.fulfill({ status: 204 })
    if (path === '/rest/v1/rpc/book_appointment') {
      const [startsAt] = tomorrowSlots()
      return json(route, {
        ok: true,
        appointment: {
          id: 'novo',
          starts_at: startsAt,
          ends_at: new Date(Date.parse(startsAt) + 30 * 60_000).toISOString(),
          service_name: 'Corte de cabelo',
          price_cents: 4500,
          status: 'pending',
        },
        manage_token: MANAGE_TOKEN,
        changes: {
          enabled: true,
          deadline: new Date(Date.parse(startsAt) - 120 * 60_000).toISOString(),
        },
      })
    }
    if (path === '/rest/v1/rpc/get_client_booking') {
      const { p_token: token } = route.request().postDataJSON() as { p_token: string }
      return json(route, token === MANAGE_TOKEN ? clientBooking() : null)
    }
    if (path === '/rest/v1/rpc/get_client_reschedule_slots') {
      return json(
        route,
        tomorrowSlots()
          .slice(1)
          .map((startsAt) => ({ starts_at: startsAt })),
      )
    }
    if (path === '/rest/v1/rpc/cancel_client_booking') return json(route, { ok: true })
    if (path === '/rest/v1/rpc/reschedule_client_booking') return json(route, { ok: true })

    const tables: Record<string, unknown[]> = {
      '/rest/v1/organizations': [organization],
      '/rest/v1/services': services,
      '/rest/v1/professionals': professionals,
      '/rest/v1/professional_services': professionalServices,
      '/rest/v1/clients': clients,
      '/rest/v1/business_hours': businessHours(),
      '/rest/v1/appointments': todaysAppointments(),
      '/rest/v1/availability_blocks': [],
    }
    if (path in tables) return rows(route, tables[path])

    return json(route, { message: `Rota não simulada: ${path}` }, 500)
  })
}

const sessionUser = {
  id: 'user-1',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'dono@exemplo.test',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: now,
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** Deixa o navegador "logado" com uma sessão falsa, antes de o app carregar. */
export async function signIn(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60
  const accessToken = [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({ sub: sessionUser.id, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    'assinatura-falsa',
  ].join('.')
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 24 * 60 * 60,
    expires_at: expiresAt,
    refresh_token: 'refresh-falso',
    user: sessionUser,
  }
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    STORAGE_KEY,
    JSON.stringify(session),
  ] as const)
}
