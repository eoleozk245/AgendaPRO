// Gerado pelo Supabase ("generate types") a partir do banco real, em 27/10/2026.
// Só os tipos auxiliares genéricos do gerador (Tables<>, Enums<>...), que o projeto
// não usa, foram omitidos. Não edite à mão: gere de novo depois de cada migração.
// As exceções (colunas preenchidas por trigger) ficam em database.types.ts.
// PENDENTE: as partes das Etapas 7a e 7b (set_professional_services, link do
// cliente) foram escritas à mão no formato do gerador, porque as migrações ainda
// não estão no banco real. Gere de novo depois de aplicá-las.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cancelled_at: string | null
          client_id: string | null
          client_token_hash: string | null
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
          cancelled_at?: string | null
          client_id?: string | null
          client_token_hash?: string | null
          created_at?: string
          duration_minutes: number
          ends_at: string
          id?: string
          notes?: string | null
          organization_id: string
          price_cents: number
          professional_id: string
          service_id: string
          service_name: string
          source?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          client_id?: string | null
          client_token_hash?: string | null
          created_at?: string
          duration_minutes?: number
          ends_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          price_cents?: number
          professional_id?: string
          service_id?: string
          service_name?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_client_fkey'
            columns: ['client_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id', 'organization_id']
          },
          {
            foreignKeyName: 'appointments_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_professional_fkey'
            columns: ['professional_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'professionals'
            referencedColumns: ['id', 'organization_id']
          },
          {
            foreignKeyName: 'appointments_service_fkey'
            columns: ['service_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'services'
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
        Relationships: [
          {
            foreignKeyName: 'availability_blocks_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_blocks_professional_fkey'
            columns: ['professional_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'professionals'
            referencedColumns: ['id', 'organization_id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'business_hours_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'clients_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
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
          client_change_min_notice_minutes: number
          client_changes_enabled: boolean
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
          client_change_min_notice_minutes?: number
          client_changes_enabled?: boolean
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
          client_change_min_notice_minutes?: number
          client_changes_enabled?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          timezone?: string
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
        Relationships: [
          {
            foreignKeyName: 'professional_services_professional_fkey'
            columns: ['professional_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'professionals'
            referencedColumns: ['id', 'organization_id']
          },
          {
            foreignKeyName: 'professional_services_service_fkey'
            columns: ['service_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id', 'organization_id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'professionals_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'services_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_appointment: {
        Args: {
          p_client_name: string
          p_client_phone: string
          p_professional_id: string
          p_service_id: string
          p_slug: string
          p_starts_at: string
        }
        Returns: Json
      }
      cancel_client_booking: { Args: { p_token: string }; Returns: Json }
      create_organization: {
        Args: { org_name: string; org_slug: string }
        Returns: {
          booking_max_days_ahead: number
          booking_min_notice_minutes: number
          client_change_min_notice_minutes: number
          client_changes_enabled: boolean
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
      get_available_slots: {
        Args: {
          p_date: string
          p_professional_id: string
          p_service_id: string
          p_slug: string
        }
        Returns: {
          starts_at: string
        }[]
      }
      get_client_booking: { Args: { p_token: string }; Returns: Json }
      get_client_reschedule_slots: {
        Args: { p_date: string; p_token: string }
        Returns: {
          starts_at: string
        }[]
      }
      get_public_booking_page: { Args: { p_slug: string }; Returns: Json }
      reschedule_client_booking: {
        Args: { p_starts_at: string; p_token: string }
        Returns: Json
      }
      set_professional_services: {
        Args: { p_professional_id: string; p_service_ids: string[] }
        Returns: undefined
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
