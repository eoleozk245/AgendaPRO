import type { AppointmentStatus } from '../agenda/status.ts'

// Para o cliente final, "pendente" é dito de um jeito mais claro.
export const CLIENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}
