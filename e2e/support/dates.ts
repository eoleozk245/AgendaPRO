// Datas relativas a "hoje" no fuso do estabelecimento, para os testes não
// quebrarem com o passar do tempo.
const TIME_ZONE = 'America/Sao_Paulo'

export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** "AAAA-MM-DD" + "HH:MM" em São Paulo (UTC-3, sem horário de verão) para ISO UTC. */
export function saoPauloToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00-03:00`).toISOString()
}
