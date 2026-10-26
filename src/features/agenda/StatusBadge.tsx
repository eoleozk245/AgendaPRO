import { Badge } from '../../components/Badge.tsx'
import type { AgendaAppointment } from './api.ts'
import { StatusIcon } from './StatusIcon.tsx'
import { STATUS_LABEL, STATUS_TONE } from './status.ts'

export function StatusBadge({ status }: { status: AgendaAppointment['status'] }) {
  return (
    <Badge tone={STATUS_TONE[status]} icon={<StatusIcon status={status} size={14} />}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}
