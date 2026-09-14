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

// Parsear color hex (#rrggbb) a canales [r, g, b]. Devuelve el rojo por
// defecto (#e63946) si el hex es inválido o falta.
function parseHex(hex: string | null | undefined): [number, number, number] {
  const DEFAULT: [number, number, number] = [230, 57, 70] // #e63946
  if (!hex) return DEFAULT
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : DEFAULT
}

// Generar las declaraciones de variables CSS del color de acento a partir de un
// hex. Devuelve --red (color base), --red-dark (hover, ~18% más oscuro) y
// --red-light (~30% hacia el blanco), en formato "r g b" para usarse con
// rgb(var(--red) / <alpha-value>) en Tailwind.
export function accentColorVars(hex: string | null | undefined): string {
  const [r, g, b] = parseHex(hex)
  const dark = [r, g, b].map(c => Math.round(c * 0.82)).join(' ')
  const light = [r, g, b].map(c => Math.round(c + (255 - c) * 0.3)).join(' ')
  return `--red: ${r} ${g} ${b}; --red-dark: ${dark}; --red-light: ${light};`
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

export interface SlotStatus {
  time: string // 'HH:mm'
  occupied: boolean
}

// Calcular todos los horarios del día (dentro de la ventana de atención y ya
// pasado el filtro de anticipación), marcando cuáles están ocupados por una
// cita/bloqueo existente. Base compartida de calculateAvailableSlots: esta
// versión conserva los horarios ocupados (en vez de descartarlos) para que la
// UI pueda mostrarlos tachados en lugar de simplemente hacerlos desaparecer.
export function calculateSlotsWithStatus({
  availability,
  existingAppointments,
  serviceDuration,
  date,
  minAdvanceMinutes = 60,
  slotIntervalMinutes = 60,
}: {
  availability: { start_time: string; end_time: string }
  existingAppointments: { starts_at: string; ends_at: string }[]
  serviceDuration: number
  date: string // 'yyyy-MM-dd'
  // Anticipación mínima en minutos. El booking público usa 60 (default); la
  // cita manual del admin pasa 0 para permitir cargar la hora actual / walk-ins.
  // El bloqueo de días pasados se mantiene siempre, independiente de este valor.
  minAdvanceMinutes?: number
  // Cada cuántos minutos se ofrece un horario (configurable por barbería,
  // ver barbershops.slot_interval_minutes). Antes estaba fijo en 60.
  slotIntervalMinutes?: number
}): SlotStatus[] {
  const slots: SlotStatus[] = []

  // Anticipación mínima: no se pueden reservar horas que empiecen dentro de
  // los próximos N minutos (0 = sin límite, para citas manuales del admin).
  const MIN_ADVANCE_MINUTES = minAdvanceMinutes

  // "Ahora" en hora de Chile, INDEPENDIENTE de la zona del servidor.
  // Esto es clave: el booking-flow corre en el navegador (hora Chile) pero el
  // agente corre en Vercel (UTC). Para que ambos calculen igual, derivamos la
  // hora local de Chile y la fecha actual de Chile a partir del reloj UTC.
  const nowChileStr = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })
  const nowChile = new Date(nowChileStr)
  const earliest = addMinutes(nowChile, MIN_ADVANCE_MINUTES)

  // Fecha de hoy en Chile (YYYY-MM-DD) para comparar si 'date' es hoy
  const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  // Ninguna fecha anterior a hoy (Chile) genera slots. La UI nunca ofrece días
  // pasados, pero lo garantizamos aquí como defensa. Ambas son 'YYYY-MM-DD', así
  // que la comparación lexicográfica coincide con la cronológica.
  if (date < todayChile) return slots

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

    if (!tooSoon) {
      slots.push({ time: format(current, 'HH:mm'), occupied: isBooked })
    }

    current = addMinutes(current, slotIntervalMinutes)
  }

  return slots
}

// Calcular slots disponibles para un día (sin los ocupados). Wrapper sobre
// calculateSlotsWithStatus para los casos que no necesitan mostrar los
// horarios ocupados (p.ej. la cita manual del admin).
export function calculateAvailableSlots(
  params: Parameters<typeof calculateSlotsWithStatus>[0]
): string[] {
  return calculateSlotsWithStatus(params)
    .filter(s => !s.occupied)
    .map(s => s.time)
}

// ── Franjas libres de un día (para elegir un rango a bloquear) ─────────────
// A diferencia de calculateAvailableSlots (duración fija, granularidad
// configurable por barbería, pensado para reservas de clientes), esto calcula
// los TRAMOS continuos libres
// del día completo —acotados por el horario de la barbería y recortando lo ya
// ocupado (citas + bloqueos existentes)— para que el usuario pueda elegir
// cualquier inicio/fin dentro de ellos, a una granularidad más fina.
export interface FreeStretch { start: string; end: string } // 'HH:mm'

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutesToHHMM(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

// Genera los horarios "de grilla" entre from y to (ambos incluidos), cada step minutos.
export function enumerateGrid(from: string, to: string, stepMinutes: number): string[] {
  const out: string[] = []
  for (let m = hhmmToMinutes(from); m <= hhmmToMinutes(to); m += stepMinutes) {
    out.push(minutesToHHMM(m))
  }
  return out
}

export function calculateFreeStretches({
  availability,
  occupied,
  date,
  granularityMinutes = 30,
  minAdvanceMinutes = 0,
}: {
  availability: { start_time: string; end_time: string } | null
  occupied: { starts_at: string; ends_at: string }[]
  date: string // 'yyyy-MM-dd'
  granularityMinutes?: number
  minAdvanceMinutes?: number
}): FreeStretch[] {
  if (!availability) return []

  const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  if (date < todayChile) return []

  const openMin = hhmmToMinutes(availability.start_time)
  const closeMin = hhmmToMinutes(availability.end_time)
  if (closeMin <= openMin) return []

  // Ocupados -> minutos "de pared" Chile, recortados a la ventana [open, close].
  // Mismo truco de toLocaleString('sv-SE', ...) que calculateAvailableSlots para
  // obtener la hora local de Chile sin importar la zona del runtime.
  const busy = occupied
    .map(o => {
      const s = hhmmToMinutes(new Date(o.starts_at).toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).slice(11, 16))
      const e = hhmmToMinutes(new Date(o.ends_at).toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).slice(11, 16))
      return [Math.max(openMin, s), Math.min(closeMin, e)] as [number, number]
    })
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const [s, e] of busy) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }

  // Anticipación mínima si la fecha pedida es hoy (misma lógica de hora de pared
  // Chile que calculateAvailableSlots).
  let earliestMin = openMin
  if (date === todayChile) {
    const nowChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
    earliestMin = nowChile.getHours() * 60 + nowChile.getMinutes() + minAdvanceMinutes
  }

  const raw: [number, number][] = []
  let cursor = Math.max(openMin, earliestMin)
  for (const [s, e] of merged) {
    if (s > cursor) raw.push([cursor, s])
    cursor = Math.max(cursor, e)
  }
  if (cursor < closeMin) raw.push([cursor, closeMin])

  // Redondear cada tramo a la grilla (inicio hacia arriba, fin hacia abajo) y
  // descartar los que quedan más angostos que un paso de grilla.
  return raw
    .map(([s, e]) => ({
      start: Math.ceil(s / granularityMinutes) * granularityMinutes,
      end: Math.floor(e / granularityMinutes) * granularityMinutes,
    }))
    .filter(({ start, end }) => end - start >= granularityMinutes)
    .map(({ start, end }) => ({ start: minutesToHHMM(start), end: minutesToHHMM(end) }))
}

// ── Horario efectivo de una fecha (semanal + horarios especiales) ──────────
// Regla única de "¿qué horario tiene la barbería este día?", compartida por la
// página de reservas, los modales del admin/barbero y la validación del
// servidor. Un horario especial (schedule_overrides) para la fecha manda sobre
// el horario semanal (availability); si no hay, se usa el del día de la semana.
export interface WeeklyAvailability { day_of_week: number; start_time: string; end_time: string }
export interface DateOverride {
  date: string // 'yyyy-MM-dd'
  is_closed: boolean
  start_time: string | null
  end_time: string | null
  label?: string | null
}

export function getDayAvailability(
  date: string, // 'yyyy-MM-dd' (fecha de pared en Chile)
  availability: WeeklyAvailability[],
  overrides: DateOverride[] = []
): { start_time: string; end_time: string } | null {
  const override = overrides.find(o => o.date === date)
  if (override) {
    if (override.is_closed || !override.start_time || !override.end_time) return null
    return { start_time: override.start_time, end_time: override.end_time }
  }
  // Día de la semana calculado sobre la fecha "de pared" (evita desfase UTC)
  const [yy, mm, dd] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()
  const weekly = availability.find(a => a.day_of_week === dow)
  return weekly ? { start_time: weekly.start_time, end_time: weekly.end_time } : null
}

// Día siguiente de una fecha 'yyyy-MM-dd' (sin zona horaria).
function nextDate(date: string): string {
  const [yy, mm, dd] = date.split('-').map(Number)
  return new Date(Date.UTC(yy, mm - 1, dd + 1)).toISOString().slice(0, 10)
}

// Todas las fechas 'yyyy-MM-dd' entre from y to, ambas incluidas.
export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = []
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const end = Date.UTC(ty, tm - 1, td)
  for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

// Agrupa horarios especiales de días seguidos con la misma configuración
// (cerrado/horas y nombre) en rangos, para mostrarlos como "24 → 26 dic".
// En la BD siguen siendo una fila por día.
export function groupOverrideRanges<T extends DateOverride>(
  overrides: T[]
): { start: string; end: string; items: T[] }[] {
  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date))
  const groups: { start: string; end: string; items: T[] }[] = []
  const sameConfig = (a: DateOverride, b: DateOverride) =>
    a.is_closed === b.is_closed &&
    (a.is_closed || (a.start_time?.slice(0, 5) === b.start_time?.slice(0, 5) &&
                     a.end_time?.slice(0, 5) === b.end_time?.slice(0, 5))) &&
    (a.label ?? '') === (b.label ?? '')

  for (const o of sorted) {
    const last = groups[groups.length - 1]
    if (last && o.date === nextDate(last.end) && sameConfig(last.items[0], o)) {
      last.items.push(o)
      last.end = o.date
    } else {
      groups.push({ start: o.date, end: o.date, items: [o] })
    }
  }
  return groups
}

// Convierte un timestamp ISO a fecha y hora de pared en Chile.
export function toChileWall(iso: string): { date: string; time: string } {
  const wall = new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Santiago' })
  return { date: wall.slice(0, 10), time: wall.slice(11, 16) }
}

// ¿El rango [startsAt, endsAt) cae completo dentro del horario de atención de
// su día? Lo usa el servidor para rechazar reservas fuera de horario.
export function isWithinOpeningHours(
  startsAt: string,
  endsAt: string,
  availability: WeeklyAvailability[],
  overrides: DateOverride[] = []
): boolean {
  const start = toChileWall(startsAt)
  const end = toChileWall(endsAt)
  if (start.date !== end.date) return false
  const day = getDayAvailability(start.date, availability, overrides)
  if (!day) return false
  return (
    hhmmToMinutes(start.time) >= hhmmToMinutes(day.start_time) &&
    hhmmToMinutes(end.time) <= hhmmToMinutes(day.end_time) &&
    hhmmToMinutes(end.time) > hhmmToMinutes(start.time)
  )
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
