/** 30 vira "30 min", 90 vira "1h 30min", 120 vira "2h". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`
}
