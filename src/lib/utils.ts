import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, addMinutes, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Utilidad de clases Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatear precio en pesos chilenos
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

// Formatear fecha en español
export function formatDate(dateStr: string, fmt = "EEEE d 'de' MMMM"): string {
  return format(parseISO(dateStr), fmt, { locale: es })
}

// Formatear hora
export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm', { locale: es })
}

// Generar slug desde nombre
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// Calcular slots disponibles para un día
export function calculateAvailableSlots({
  availability,
  existingAppointments,
  serviceDuration,
  date,
}: {
  availability: { start_time: string; end_time: string }
  existingAppointments: { starts_at: string; ends_at: string }[]
  serviceDuration: number
  date: string // 'yyyy-MM-dd'
}): string[] {
  const slots: string[] = []
  const now = new Date()

  // start_time puede venir como "09:00" o "09:00:00" desde PostgreSQL
  const startTime = availability.start_time.slice(0, 5)
  const endTime = availability.end_time.slice(0, 5)
  const base = new Date(`${date}T${startTime}:00`)
  const close = new Date(`${date}T${endTime}:00`)

  let current = new Date(base)

  while (addMinutes(current, serviceDuration) <= close) {
    const slotEnd = addMinutes(current, serviceDuration)

    const isBooked = existingAppointments.some(apt => {
      const aptStart = parseISO(apt.starts_at)
      const aptEnd = parseISO(apt.ends_at)
      return current < aptEnd && slotEnd > aptStart
    })

    const isPast = current <= now

    if (!isBooked && !isPast) {
      slots.push(format(current, 'HH:mm'))
    }

    current = addMinutes(current, 30) // granularidad de 30 min
  }

  return slots
}

// Días de la semana
export const DAYS: { key: string; label: string; index: number }[] = [
  { key: 'sun', label: 'Domingo', index: 0 },
  { key: 'mon', label: 'Lunes', index: 1 },
  { key: 'tue', label: 'Martes', index: 2 },
  { key: 'wed', label: 'Miércoles', index: 3 },
  { key: 'thu', label: 'Jueves', index: 4 },
  { key: 'fri', label: 'Viernes', index: 5 },
  { key: 'sat', label: 'Sábado', index: 6 },
]
