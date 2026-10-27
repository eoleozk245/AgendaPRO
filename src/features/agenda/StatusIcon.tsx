import { Check, CircleCheck, Clock, UserX, X, type LucideProps } from 'lucide-react'
import type { AppointmentStatus } from './status.ts'

const icons = {
  pending: Clock,
  confirmed: CircleCheck,
  completed: Check,
  cancelled: X,
  no_show: UserX,
} as const

export function StatusIcon({ status, ...props }: { status: AppointmentStatus } & LucideProps) {
  const Icon = icons[status]
  return <Icon aria-hidden="true" {...props} />
}
