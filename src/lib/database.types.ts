// Gerado a partir do banco (Supabase "generate types"). Gere de novo depois de
// cada migração aplicada. As tabelas da Etapa 3 foram escritas à mão no mesmo
// formato porque a migração ainda não foi aplicada no projeto remoto.
// O mesmo vale para as tabelas da Etapa 4 (appointments, availability_blocks)
// e para as funções e colunas da Etapa 5 (página pública).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          duration_minutes: number
          ends_at: string
          id: string
          notes: string | null
          organization_id: string
          price_cents: number
          professional_id: string
          service_id: string
          service_name: string
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          notes?: string | null
          organization_id: string
          professional_id: string
          service_id: string
          starts_at: string
          status?: string
        }
        Update: {
          client_id?: string | null
          notes?: string | null
          professional_id?: string
          service_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_client_fkey'
            columns: ['client_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          organization_id: string
          professional_id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          organization_id: string
          professional_id: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          organization_id?: string
          professional_id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          opens_at: string
          organization_id: string
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          opens_at: string
          organization_id: string
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          opens_at?: string
          organization_id?: string
          weekday?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      professional_services: {
        Row: {
          organization_id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          organization_id: string
          professional_id: string
          service_id: string
        }
        Update: {
          organization_id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: []
      }
      professionals: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          organization_id: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          organization_id: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          organization_id?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          booking_max_days_ahead: number
          booking_min_notice_minutes: number
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          booking_max_days_ahead?: number
          booking_min_notice_minutes?: number
          created_at?: string
          id?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          booking_max_days_ahead?: number
          booking_min_notice_minutes?: number
          created_at?: string
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_appointment: {
        Args: {
          p_slug: string
          p_service_id: string
          p_professional_id: string
          p_starts_at: string
          p_client_name: string
          p_client_phone: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: { p_slug: string; p_service_id: string; p_professional_id: string; p_date: string }
        Returns: { starts_at: string }[]
      }
      get_public_booking_page: {
        Args: { p_slug: string }
        Returns: Json
      }
      create_organization: {
        Args: { org_name: string; org_slug: string }
        Returns: {
          booking_max_days_ahead: number
          booking_min_notice_minutes: number
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'organizations'
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type Organization = Row<'organizations'>
export type Service = Row<'services'>
export type Professional = Row<'professionals'>
export type BusinessHour = Row<'business_hours'>
export type Client = Row<'clients'>
export type Appointment = Row<'appointments'>
export type AvailabilityBlock = Row<'availability_blocks'>
