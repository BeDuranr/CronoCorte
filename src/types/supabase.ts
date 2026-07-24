export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          barbershop_id: string
          booking_group_id: string | null
          cancel_token: string | null
          cancellation_reason: string | null
          client_name: string
          client_phone: string
          created_at: string | null
          ends_at: string
          id: string
          notes: string | null
          payment_amount: number | null
          payment_receipt_url: string | null
          payment_verified: boolean | null
          recommended_style: string | null
          reminder_1h_sent: boolean | null
          reminder_24h_sent: boolean | null
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          total_amount: number | null
          worker_id: string
        }
        Insert: {
          barbershop_id: string
          booking_group_id?: string | null
          cancel_token?: string | null
          cancellation_reason?: string | null
          client_name: string
          client_phone: string
          created_at?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          payment_amount?: number | null
          payment_receipt_url?: string | null
          payment_verified?: boolean | null
          recommended_style?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          total_amount?: number | null
          worker_id: string
        }
        Update: {
          barbershop_id?: string
          booking_group_id?: string | null
          cancel_token?: string | null
          cancellation_reason?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          payment_amount?: number | null
          payment_receipt_url?: string | null
          payment_verified?: boolean | null
          recommended_style?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          total_amount?: number | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "public_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          barbershop_id: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          is_available: boolean | null
          start_time: string
          worker_id: string | null
        }
        Insert: {
          barbershop_id?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          start_time: string
          worker_id?: string | null
        }
        Update: {
          barbershop_id?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          start_time?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "public_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops: {
        Row: {
          accent_color: string | null
          address: string | null
          admin_id: string
          agent_enabled: boolean | null
          agent_name: string | null
          agent_prompt_custom: string | null
          agent_tone: Database["public"]["Enums"]["agent_tone"] | null
          cancel_policy: string | null
          created_at: string | null
          description: string | null
          id: string
          instagram: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          payment_info: Json | null
          payment_required: boolean | null
          phone: string | null
          reminder_timings: string[] | null
          schedule_config: Json | null
          slot_interval_minutes: number
          slug: string
          transfer_info: string | null
          whatsapp_template_confirmed: string | null
          whatsapp_template_reminder: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          admin_id: string
          agent_enabled?: boolean | null
          agent_name?: string | null
          agent_prompt_custom?: string | null
          agent_tone?: Database["public"]["Enums"]["agent_tone"] | null
          cancel_policy?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          payment_info?: Json | null
          payment_required?: boolean | null
          phone?: string | null
          reminder_timings?: string[] | null
          schedule_config?: Json | null
          slot_interval_minutes?: number
          slug: string
          transfer_info?: string | null
          whatsapp_template_confirmed?: string | null
          whatsapp_template_reminder?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          admin_id?: string
          agent_enabled?: boolean | null
          agent_name?: string | null
          agent_prompt_custom?: string | null
          agent_tone?: Database["public"]["Enums"]["agent_tone"] | null
          cancel_policy?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          payment_info?: Json | null
          payment_required?: boolean | null
          phone?: string | null
          reminder_timings?: string[] | null
          schedule_config?: Json | null
          slot_interval_minutes?: number
          slug?: string
          transfer_info?: string | null
          whatsapp_template_confirmed?: string | null
          whatsapp_template_reminder?: string | null
        }
        Relationships: []
      }
      blocked_slots: {
        Row: {
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          worker_id: string
        }
        Insert: {
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          worker_id: string
        }
        Update: {
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_slots_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "public_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_slots_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_photos: {
        Row: {
          barbershop_id: string
          created_at: string | null
          face_shapes: string[] | null
          hair_types: string[] | null
          id: string
          photo_url: string
          style_tags: string[] | null
          worker_id: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string | null
          face_shapes?: string[] | null
          hair_types?: string[] | null
          id?: string
          photo_url: string
          style_tags?: string[] | null
          worker_id: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string | null
          face_shapes?: string[] | null
          hair_types?: string[] | null
          id?: string
          photo_url?: string
          style_tags?: string[] | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "public_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          barbershop_id: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          price: number
          sort_order: number | null
        }
        Insert: {
          barbershop_id: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          sort_order?: number | null
        }
        Update: {
          barbershop_id?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      workers: {
        Row: {
          avatar_url: string | null
          barbershop_id: string
          calendar_token: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          photo_url: string | null
          specialties: string[] | null
          specialty: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          barbershop_id: string
          calendar_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          specialty?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          barbershop_id?: string
          calendar_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          specialties?: string[] | null
          specialty?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_workers: {
        Row: {
          avatar_url: string | null
          barbershop_id: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          specialty: string | null
        }
        Insert: {
          avatar_url?: string | null
          barbershop_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          specialty?: string | null
        }
        Update: {
          avatar_url?: string | null
          barbershop_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agent_tone: "relajado" | "formal" | "juvenil"
      appointment_status:
        | "pending_payment"
        | "confirmed"
        | "cancelled"
        | "completed"
      user_role: "admin" | "worker"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_tone: ["relajado", "formal", "juvenil"],
      appointment_status: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
      ],
      user_role: ["admin", "worker"],
    },
  },
} as const
