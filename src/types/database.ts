// Tipos derivados del schema de Supabase.
// El archivo base (supabase.ts) se regenera con /db-types — no editar a mano.

import type { Database } from './supabase'

export type { Database, Json } from './supabase'

// ── Enums ──────────────────────────────────────────────────────────────────────
export type UserRole          = Database['public']['Enums']['user_role']
export type AppointmentStatus = Database['public']['Enums']['appointment_status']
export type AgentTone         = Database['public']['Enums']['agent_tone']

// ── Row types ─────────────────────────────────────────────────────────────────
export type UserProfile    = Database['public']['Tables']['user_profiles']['Row']
export type Barbershop     = Database['public']['Tables']['barbershops']['Row']
export type Worker         = Database['public']['Tables']['workers']['Row']
export type Service        = Database['public']['Tables']['services']['Row']
export type Availability   = Database['public']['Tables']['availability']['Row']
export type BlockedSlot    = Database['public']['Tables']['blocked_slots']['Row']
export type PortfolioPhoto = Database['public']['Tables']['portfolio_photos']['Row']

export type Appointment = Database['public']['Tables']['appointments']['Row'] & {
  worker?: Worker
  service?: Service
}

// ── Tipos auxiliares para columnas JSON ───────────────────────────────────────
// schedule_config y payment_info se guardan como Json en la DB;
// estas interfaces describen su estructura interna al parsearlas.
export interface ScheduleConfig {
  [day: string]: { open: string; close: string; active: boolean }
}

export interface PaymentInfo {
  banco?: string
  cuenta?: string
  titular?: string
  tipo?: string // corriente | vista | ahorro
}

// ── Tipo computado (no existe en la DB) ───────────────────────────────────────
export interface TimeSlot {
  starts_at: string
  ends_at: string
  available: boolean
}
