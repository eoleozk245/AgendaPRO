// Conversões entre o horário local do estabelecimento e instantes UTC.
// O banco guarda timestamptz (UTC); a tela mostra e recebe horário local.
// Datas locais circulam como texto "AAAA-MM-DD" e horas como "HH:MM".

type Parts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function zonedParts(instant: Date, timeZone: string): Parts {
  let formatter = partsFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, formatter)
  }
  const values: Record<string, number> = {}
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

/** Diferença (ms) entre o relógio local no fuso e o UTC naquele instante. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** "2030-01-07" + "10:00" no fuso dado vira o instante UTC correspondente. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  // Duas passadas resolvem as viradas de horário de verão.
  const first = guess - offsetMs(new Date(guess), timeZone)
  return new Date(guess - offsetMs(new Date(first), timeZone))
}

/** Instante UTC visto no fuso do estabelecimento. */
export function utcToZoned(instant: Date | string, timeZone: string) {
  const p = zonedParts(new Date(instant), timeZone)
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`
  return {
    date,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    minutesOfDay: p.hour * 60 + p.minute,
    weekday: weekdayOf(date),
  }
}

export function todayIn(timeZone: string): string {
  return utcToZoned(new Date(), timeZone).date
}

/** Soma dias numa data de calendário (sem fuso envolvido). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

/** 0 = domingo ... 6 = sábado. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Segunda-feira da semana da data. */
export function startOfWeek(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7))
}

const dayLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const shortLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
})

function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

/** "segunda-feira, 7 de janeiro" */
export function formatDayLabel(date: string): string {
  return dayLabel.format(calendarDate(date))
}

/** "7 de jan." */
export function formatShortDate(date: string): string {
  return shortLabel.format(calendarDate(date))
}

/** "HH:MM" para minutos desde a meia-noite. */
export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}
