// Tipos TypeScript generados del schema de Supabase
// Actualizar corriendo: npx supabase gen types typescript --project-id YOUR_ID > src/types/database.ts

export type UserRole = 'admin' | 'worker'
export type AppointmentStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed'
export type AgentTone = 'relajado' | 'formal' | 'juvenil'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  created_at: string
}

export interface Barbershop {
  id: string
  admin_id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  logo_url: string | null
  description: string | null
  schedule_config: ScheduleConfig
  payment_required: boolean
  payment_info: PaymentInfo
  agent_name: string
  agent_tone: AgentTone
  agent_prompt_custom: string
  created_at: string
}

export interface ScheduleConfig {
  [day: string]: { open: string; close: string; active: boolean }
  // day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
}

export interface PaymentInfo {
  banco?: string
  cuenta?: string
  titular?: string
  tipo?: string // corriente | vista | ahorro
}

export interface Worker {
  id: string
  barbershop_id: string
  user_id: string | null
  name: string
  photo_url: string | null
  phone: string | null
  specialties: string[]
  calendar_token: string
  is_active: boolean
  created_at: string
}

export interface Service {
  id: string
  barbershop_id: string
  name: string
  description: string | null
  price: number
  duration_min: number
  is_active: boolean
}

export interface Availability {
  id: string
  worker_id: string
  day_of_week: number // 0=Dom ... 6=Sáb
  start_time: string  // "HH:MM"
  end_time: string    // "HH:MM"
  is_available: boolean
}

export interface BlockedSlot {
  id: string
  worker_id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

export interface Appointment {
  id: string
  barbershop_id: string
  worker_id: string
  service_id: string
  client_name: string
  client_phone: string
  recommended_style: string | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  cancel_token: string
  payment_receipt_url: string | null
  payment_amount: number | null
  payment_verified: boolean
  reminder_24h_sent: boolean
  reminder_1h_sent: boolean
  created_at: string
  // Joins opcionales
  worker?: Worker
  service?: Service
}

export interface PortfolioPhoto {
  id: string
  worker_id: string
  barbershop_id: string
  photo_url: string
  style_tags: string[]
  face_shapes: string[]
  hair_types: string[]
  created_at: string
}

// Slots de tiempo calculados para el calendar
export interface TimeSlot {
  starts_at: string // ISO string
  ends_at: string
  available: boolean
}
