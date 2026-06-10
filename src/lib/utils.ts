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

// Convertir color hex (#rrggbb) a canales "r g b" para la variable CSS --red.
// Devuelve el rojo por defecto si el hex es inválido o falta.
export function hexToRgbChannels(hex: string | null | undefined): string {
  const DEFAULT = '230 57 70' // #e63946
  if (!hex) return DEFAULT
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  return m
    ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`
    : DEFAULT
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

  // Anticipación mínima: no se pueden reservar horas que empiecen dentro de
  // los próximos 60 minutos.
  const MIN_ADVANCE_MINUTES = 60

  // "Ahora" en hora de Chile, INDEPENDIENTE de la zona del servidor.
  // Esto es clave: el booking-flow corre en el navegador (hora Chile) pero el
  // agente corre en Vercel (UTC). Para que ambos calculen igual, derivamos la
  // hora local de Chile y la fecha actual de Chile a partir del reloj UTC.
  const nowChileStr = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })
  const nowChile = new Date(nowChileStr)
  const earliest = addMinutes(nowChile, MIN_ADVANCE_MINUTES)

  // Fecha de hoy en Chile (YYYY-MM-DD) para comparar si 'date' es hoy
  const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  // start_time puede venir como "09:00" o "09:00:00" desde PostgreSQL
  const startTime = availability.start_time.slice(0, 5)
  const endTime = availability.end_time.slice(0, 5)

  // Construimos los slots como horas "de pared" (naif) del día pedido.
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const [yy, mm, dd] = date.split('-').map(Number)

  // base y close como Date naif (en la zona del runtime, pero solo los usamos
  // para iterar horas/minutos, no para comparar contra "ahora").
  let current = new Date(yy, mm - 1, dd, sh, sm, 0, 0)
  const close = new Date(yy, mm - 1, dd, eh, em, 0, 0)

  // ¿El día pedido es hoy en Chile? Solo entonces aplica el filtro de anticipación.
  const isToday = date === todayChile

  // Hora+min actuales en Chile (para comparar "de pared" contra los slots)
  const earliestChileMinutes =
    earliest.getHours() * 60 + earliest.getMinutes()
  const earliestIsSameDay =
    earliest.toLocaleDateString('en-CA') === nowChile.toLocaleDateString('en-CA')

  while (addMinutes(current, serviceDuration) <= close) {
    const slotEnd = addMinutes(current, serviceDuration)

    // Hora de pared del slot en formato comparable "YYYY-MM-DDTHH:mm"
    const slotStartWall = `${date}T${format(current, 'HH:mm')}`
    const slotEndWall = `${date}T${format(slotEnd, 'HH:mm')}`

    const isBooked = existingAppointments.some(apt => {
      // Convertir la cita (guardada en UTC con offset) a hora de pared de Chile,
      // para comparar manzanas con manzanas contra el slot.
      const aptStartWall = new Date(apt.starts_at)
        .toLocaleString('sv-SE', { timeZone: 'America/Santiago' })
        .replace(' ', 'T')
        .slice(0, 16)
      const aptEndWall = new Date(apt.ends_at)
        .toLocaleString('sv-SE', { timeZone: 'America/Santiago' })
        .replace(' ', 'T')
        .slice(0, 16)
      // Solapan si el slot empieza antes de que termine la cita y termina después de que empieza
      return slotStartWall < aptEndWall && slotEndWall > aptStartWall
    })

    // Filtro de anticipación: solo si el día pedido es hoy en Chile.
    let tooSoon = false
    if (isToday) {
      const slotMinutes = current.getHours() * 60 + current.getMinutes()
      // Si earliest pasó a ser mañana (caso nocturno), todo hoy queda fuera.
      tooSoon = earliestIsSameDay ? slotMinutes < earliestChileMinutes : true
    }

    if (!isBooked && !tooSoon) {
      slots.push(format(current, 'HH:mm'))
    }

    current = addMinutes(current, 60) // granularidad de 1 hora
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
