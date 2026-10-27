import type { Database as Generated } from './database.generated.ts'

export type { Json } from './database.generated.ts'

type Tables = Generated['public']['Tables']

// O banco preenche nome, duração, preço e fim do agendamento por trigger e só
// aceita estas colunas do cliente (grants por coluna). O tipo gerado exige todas
// as colunas sem default; aqui descrevemos o que o app realmente envia.
type AppointmentsTable = Omit<Tables['appointments'], 'Insert' | 'Update'> & {
  Insert: Pick<
    Tables['appointments']['Insert'],
    'organization_id' | 'professional_id' | 'service_id' | 'starts_at'
  > &
    Partial<Pick<Tables['appointments']['Insert'], 'client_id' | 'status' | 'notes'>>
  Update: Partial<
    Pick<
      Tables['appointments']['Update'],
      'professional_id' | 'service_id' | 'client_id' | 'starts_at' | 'status' | 'notes'
    >
  >
}

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Generated['public'], 'Tables'> & {
    Tables: Omit<Tables, 'appointments'> & { appointments: AppointmentsTable }
  }
}

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type Organization = Row<'organizations'>
export type Service = Row<'services'>
export type Professional = Row<'professionals'>
export type ProfessionalService = Row<'professional_services'>
export type BusinessHour = Row<'business_hours'>
export type Client = Row<'clients'>
export type Appointment = Row<'appointments'>
export type AvailabilityBlock = Row<'availability_blocks'>
