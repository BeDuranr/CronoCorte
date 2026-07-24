'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice, calculateAvailableSlots } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Loader2, ChevronLeft, Phone, Download, X, Plus, BanIcon, Trash2
} from 'lucide-react'
import Link from 'next/link'
import { BlockTimeModal } from '@/components/scheduling/block-time-modal'

interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
}

interface AvailabilityRow {
  day_of_week: number
  start_time: string
  end_time: string
}

interface BlockedSlot {
  id: string
  worker_id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

interface Props {
  barbershopId: string
  appointments: any[]
  workers: { id: string; name: string }[]
  services: Service[]
  availability: AvailabilityRow[]
  blockedSlots: BlockedSlot[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending_payment: { label: 'Pendiente pago', color: 'text-yellow-500', dot: 'bg-yellow-500' },
  confirmed:       { label: 'Confirmada',     color: 'text-green-500',  dot: 'bg-green-500'  },
  completed:       { label: 'Completada',     color: 'text-[rgb(var(--fg-secondary))]', dot: 'bg-[rgb(var(--fg-secondary))]' },
  cancelled:       { label: 'Cancelada',      color: 'text-brand-red',  dot: 'bg-brand-red'  },
}

const CANCEL_REASONS = [
  'Cliente pidió',
  'No pagó',
  'Barbero no disponible',
  'Otro',
]

function formatDayLabel(dateStr: string) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  if (isYesterday(d)) return 'Ayer'
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

// ── Modal cancelar con motivo ─────────────────────────────────────────────────
function CancelModal({
  appt,
  onCancel,
  onClose,
}: {
  appt: any
  onCancel: (id: string, reason: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    setLoading(true)
    await onCancel(appt.id, reason)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <b className="text-sm text-[rgb(var(--fg))]">Cancelar cita de {appt.client_name}</b>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--fg-secondary))] mb-4">
          Se notificará al cliente por WhatsApp.
        </p>
        <p className="label mb-2">Motivo</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {CANCEL_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                reason === r
                  ? 'border-brand-red text-brand-red bg-brand-red/5'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Volver</button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="btn-primary text-sm py-1.5 px-4 bg-brand-red hover:bg-[#bd2f39]"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Cancelar cita'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal confirmar eliminación permanente ────────────────────────────────────
function DeleteModal({
  appt,
  onDelete,
  onClose,
}: {
  appt: any
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    await onDelete(appt.id)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <b className="text-sm text-[rgb(var(--fg))]">Eliminar cita de {appt.client_name}</b>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--fg-secondary))] mb-5">
          ¿Estás seguro que quieres eliminar esta cita? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Volver</button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="btn-primary text-sm py-1.5 px-4 bg-brand-red hover:bg-[#bd2f39]"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Construye starts_at/ends_at con offset local (hora de pared Chile),
// mismo patrón que el booking-flow público.
function buildTimestamps(dateStr: string, time: string, durationMin: number) {
  const localStart = new Date(`${dateStr}T${time}:00`)
  const offsetMinutes = localStart.getTimezoneOffset()
  const offsetSign = offsetMinutes <= 0 ? '+' : '-'
  const offsetAbs = Math.abs(offsetMinutes)
  const offsetHH = String(Math.floor(offsetAbs / 60)).padStart(2, '0')
  const offsetMM = String(offsetAbs % 60).padStart(2, '0')
  const tz = `${offsetSign}${offsetHH}:${offsetMM}`
  const startsAt = `${dateStr}T${time}:00${tz}`
  const endLocal = new Date(localStart.getTime() + durationMin * 60_000)
  const endHH = String(endLocal.getHours()).padStart(2, '0')
  const endMM = String(endLocal.getMinutes()).padStart(2, '0')
  const endsAt = `${dateStr}T${endHH}:${endMM}:00${tz}`
  return { startsAt, endsAt }
}

// ── Modal de cita manual ──────────────────────────────────────────────────────
function ManualAppointmentModal({
  barbershopId,
  workers,
  services,
  availability,
  onClose,
  onCreated,
}: {
  barbershopId: string
  workers: { id: string; name: string }[]
  services: Service[]
  availability: AvailabilityRow[]
  onClose: () => void
  onCreated: (appt: any) => void
}) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? '')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(todayStr)
  const [time, setTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [status, setStatus] = useState<'confirmed' | 'pending_payment'>('confirmed')
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const service = services.find(s => s.id === serviceId)
  const worker = workers.find(w => w.id === workerId)
  const duration = service?.duration_minutes || 60

  // Días de la semana (0–6) que atiende la barbería, según su availability.
  const openDows = useMemo(
    () => new Set(availability.map(a => a.day_of_week)),
    [availability]
  )

  // Próximas fechas disponibles: días futuros cuyo day_of_week atiende la barbería.
  const availableDates = useMemo(() => {
    const [ty, tm, td] = todayStr.split('-').map(Number)
    const out: { value: string; weekday: string; day: string; month: string }[] = []
    for (let i = 0; i < 60 && out.length < 30; i++) {
      const d = new Date(ty, tm - 1, td + i)
      if (!openDows.has(d.getDay())) continue
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      out.push({
        value,
        weekday: format(d, 'EEE', { locale: es }),
        day: format(d, 'd'),
        month: format(d, 'MMM', { locale: es }),
      })
    }
    return out
  }, [todayStr, openDows])

  // Si la fecha elegida ya no está disponible (cambió el barbero), salta a la primera.
  useEffect(() => {
    if (availableDates.length === 0) return
    if (!availableDates.some(d => d.value === date)) setDate(availableDates[0].value)
  }, [availableDates]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recalcular slots libres cuando cambia barbero, servicio o fecha.
  useEffect(() => {
    let cancelled = false
    setTime('')
    if (!workerId || !serviceId || !date) { setSlots([]); return }

    const load = async () => {
      setLoadingSlots(true)
      try {
        // day_of_week local de la fecha elegida (evita desfase UTC)
        const [yy, mm, dd] = date.split('-').map(Number)
        const dow = new Date(yy, mm - 1, dd).getDay()
        const avail = availability.find(a => a.day_of_week === dow)
        if (!avail) { if (!cancelled) setSlots([]); return }

        let occupied: { starts_at: string; ends_at: string }[] = []
        try {
          const res = await fetch(`/api/availability?worker_id=${encodeURIComponent(workerId)}&date=${date}`)
          if (res.ok) { const json = await res.json(); occupied = json.occupied ?? [] }
        } catch { occupied = [] }

        const available = calculateAvailableSlots({
          availability: avail,
          existingAppointments: occupied,
          serviceDuration: duration,
          date,
          minAdvanceMinutes: 0, // admin: sin límite de anticipación
        })
        if (!cancelled) setSlots(available)
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [workerId, serviceId, date, duration, availability])

  const handleSubmit = async () => {
    if (!clientName.trim()) return toast.error('El nombre del cliente es requerido')
    if (!time) return toast.error('Elige un horario')
    if (!service || !worker) return toast.error('Elige barbero y servicio')

    setSubmitting(true)
    try {
      const { startsAt, endsAt } = buildTimestamps(date, time, duration)
      // Normalizar teléfono: prefijo +56 si el admin lo ingresó sin él.
      let phone = clientPhone.trim()
      if (phone && !phone.startsWith('+')) phone = `+56${phone.replace(/\D/g, '')}`

      const res = await fetch('/api/appointments/admin-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbershop_id: barbershopId,
          worker_id: workerId,
          service_id: serviceId,
          client_name: clientName.trim(),
          client_phone: phone,
          starts_at: startsAt,
          ends_at: endsAt,
          status,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.message || 'Error al crear la cita'); return }

      onCreated({
        id: data.id,
        client_name: clientName.trim(),
        client_phone: phone,
        starts_at: startsAt,
        ends_at: endsAt,
        status: data.status ?? status,
        payment_verified: false,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        services: { name: service.name, price: service.price, duration_minutes: service.duration_minutes },
        workers: { name: worker.name },
      })
      toast.success('Cita creada')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <b className="text-sm text-[rgb(var(--fg))]">Nueva cita manual</b>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]">
            <X size={14} />
          </button>
        </div>

        {workers.length === 0 || services.length === 0 ? (
          <p className="text-xs text-[rgb(var(--fg-secondary))]">
            Necesitas al menos un barbero y un servicio activos para crear una cita.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Barbero */}
            <div>
              <p className="label mb-1">Barbero</p>
              <select className="input w-full" value={workerId} onChange={e => setWorkerId(e.target.value)}>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Servicio */}
            <div>
              <p className="label mb-1">Servicio</p>
              <select className="input w-full" value={serviceId} onChange={e => setServiceId(e.target.value)}>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatPrice(s.price)} · {s.duration_minutes} min
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <p className="label mb-1">Fecha</p>
              {availableDates.length === 0 ? (
                <p className="text-xs text-[rgb(var(--fg-secondary))] py-2">
                  No hay días de atención configurados. Revísalos en Configuración.
                </p>
              ) : (
                <div className="-mx-1 px-1 overflow-x-auto">
                  <div className="flex gap-2 min-w-max pb-1">
                    {availableDates.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDate(d.value)}
                        className={`flex flex-col items-center py-2 px-3 rounded-lg border transition-all shrink-0 ${
                          date === d.value
                            ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                            : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                        }`}
                      >
                        <span className="text-[9px] uppercase">{d.weekday.slice(0, 3)}</span>
                        <span className="text-sm font-bold leading-tight">{d.day}</span>
                        <span className="text-[9px] uppercase">{d.month}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Slots */}
            <div>
              <p className="label mb-1">Horario</p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-xs text-[rgb(var(--fg-secondary))] py-2">
                  <Loader2 size={13} className="animate-spin" /> Buscando horarios…
                </div>
              ) : slots.length === 0 ? (
                <p className="text-xs text-[rgb(var(--fg-secondary))] py-2">
                  No hay horarios libres ese día para este barbero.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map(s => (
                    <button
                      key={s}
                      onClick={() => setTime(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        time === s
                          ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                          : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cliente */}
            <div>
              <p className="label mb-1">Nombre del cliente</p>
              <input
                className="input w-full"
                placeholder="Ej: Juan Pérez"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
              />
            </div>

            {/* Teléfono (opcional) */}
            <div>
              <p className="label mb-1">Teléfono <span className="text-[rgb(var(--fg-secondary))]">(opcional)</span></p>
              <input
                className="input w-full"
                placeholder="9 1234 5678"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
              />
            </div>

            {/* Estado */}
            <div>
              <p className="label mb-1">Estado</p>
              <div className="flex gap-2">
                {([
                  { key: 'confirmed', label: 'Confirmada' },
                  { key: 'pending_payment', label: 'Pendiente pago' },
                ] as const).map(o => (
                  <button
                    key={o.key}
                    onClick={() => setStatus(o.key)}
                    className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      status === o.key
                        ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                        : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div>
              <p className="label mb-1">Notas <span className="text-[rgb(var(--fg-secondary))]">(opcional)</span></p>
              <input
                className="input w-full"
                placeholder="Observaciones internas"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 mt-1">
              <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1"
              >
                {submitting ? <Loader2 size={13} className="animate-spin" /> : 'Crear cita'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vista de citas ────────────────────────────────────────────────────────────
export function CitasView({ barbershopId, appointments: initial, workers, services, availability, blockedSlots: initialBlocked }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>(initial)
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>(initialBlocked)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancelAppt, setCancelAppt] = useState<any | null>(null)
  const [deleteAppt, setDeleteAppt] = useState<any | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [showBlock, setShowBlock] = useState(false)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  // ── Swipe-to-delete (solo citas canceladas) ──────────────────────────────
  const SWIPE_THRESHOLD = 70
  const touchStartRef = useRef<{ id: string; x: number } | null>(null)
  const [swipeDelta, setSwipeDelta] = useState<{ id: string; x: number } | null>(null)

  const handleTouchStart = (appt: any) => (e: React.TouchEvent) => {
    if (appt.status !== 'cancelled') return
    touchStartRef.current = { id: appt.id, x: e.touches[0].clientX }
    setSwipeDelta({ id: appt.id, x: 0 })
  }

  const handleTouchMove = (appt: any) => (e: React.TouchEvent) => {
    if (!touchStartRef.current || touchStartRef.current.id !== appt.id) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    setSwipeDelta({ id: appt.id, x: dx })
  }

  const handleTouchEnd = (appt: any) => () => {
    if (!touchStartRef.current || touchStartRef.current.id !== appt.id) return
    const dx = swipeDelta && swipeDelta.id === appt.id ? swipeDelta.x : 0
    touchStartRef.current = null
    setSwipeDelta(null)
    if (Math.abs(dx) > SWIPE_THRESHOLD) setDeleteAppt(appt)
  }

  const deleteAppointment = async (id: string) => {
    const res = await fetch('/api/appointments/admin-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.message || 'Error al eliminar')
    } else {
      const groupId = deleteAppt?.booking_group_id
      setAppointments(prev => prev.filter(a => groupId ? a.booking_group_id !== groupId : a.id !== id))
      toast.success('Cita eliminada')
    }
    setDeleteAppt(null)
  }

  // Abrir el modal automáticamente si se llega con ?nuevo=1 (botón del dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevo') === '1') setShowManual(true)
  }, [])

  const closeManual = () => {
    setShowManual(false)
    // Limpiar el ?nuevo=1 de la URL sin recargar
    if (new URLSearchParams(window.location.search).get('nuevo')) {
      router.replace('/dashboard/citas')
    }
  }

  const addCreated = (appt: any) => {
    setAppointments(prev => [appt, ...prev])
  }

  const addBlocked = (block: BlockedSlot) => {
    setBlockedSlots(prev => [...prev, block].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()))
  }

  const unblockAdmin = async (id: string) => {
    setUnblockingId(id)
    const { error } = await supabase.from('blocked_slots').delete().eq('id', id)
    if (error) {
      toast.error('Error al desbloquear')
    } else {
      setBlockedSlots(prev => prev.filter(b => b.id !== id))
      toast.success('Horario desbloqueado')
    }
    setUnblockingId(null)
  }

  // Conteos por estado
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, pending_payment: 0, confirmed: 0, completed: 0, cancelled: 0 }
    appointments.forEach(a => {
      c.all++
      if (c[a.status] !== undefined) c[a.status]++
    })
    return c
  }, [appointments])

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      const matchSearch =
        !search ||
        a.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.client_phone?.includes(search) ||
        a.services?.name?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      const matchWorker = workerFilter === 'all' || a.workers?.name === workerFilter
      return matchSearch && matchStatus && matchWorker
    })
  }, [appointments, search, statusFilter, workerFilter])

  const dayKeyChile = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    filtered.forEach(a => {
      const day = dayKeyChile(a.starts_at)
      if (!map[day]) map[day] = []
      map[day].push(a)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)) // newest first
  }, [filtered])

  const updateStatus = async (id: string, status: string) => {
    setLoadingId(id)
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (error) {
      toast.error('Error al actualizar')
    } else {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      toast.success('Cita actualizada')
    }
    setLoadingId(null)
  }

  const cancelWithReason = async (id: string, reason: string) => {
    setLoadingId(id)
    const res = await fetch('/api/appointments/admin-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.message || 'Error al cancelar')
    } else {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
      toast.success('Cita cancelada')
    }
    setLoadingId(null)
    setCancelAppt(null)
  }

  const markComplete = async (appt: any) => {
    const newStatus = appt.status === 'pending_payment' ? 'confirmed' : 'completed'
    await updateStatus(appt.id, newStatus)
  }

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Fecha', 'Hora', 'Cliente', 'Teléfono', 'Servicio', 'Barbero', 'Estado', 'Precio']
    const rows = filtered.map(a => [
      dayKeyChile(a.starts_at),
      format(parseISO(a.starts_at), 'HH:mm'),
      a.client_name ?? '',
      a.client_phone ?? '',
      a.services?.name ?? '',
      a.workers?.name ?? '',
      a.status ?? '',
      a.services?.price ?? 0,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'citas.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const STATUS_CHIPS = [
    { key: 'all', label: 'Todas' },
    { key: 'pending_payment', label: 'Pendiente pago' },
    { key: 'confirmed', label: 'Confirmadas' },
    { key: 'completed', label: 'Completadas' },
    { key: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <>
      {cancelAppt && (
        <CancelModal
          appt={cancelAppt}
          onCancel={cancelWithReason}
          onClose={() => setCancelAppt(null)}
        />
      )}

      {deleteAppt && (
        <DeleteModal
          appt={deleteAppt}
          onDelete={deleteAppointment}
          onClose={() => setDeleteAppt(null)}
        />
      )}

      {showManual && (
        <ManualAppointmentModal
          barbershopId={barbershopId}
          workers={workers}
          services={services}
          availability={availability}
          onClose={closeManual}
          onCreated={addCreated}
        />
      )}

      {showBlock && workers[0] && (
        <BlockTimeModal
          workerId={workers[0].id}
          availability={availability}
          onCreated={addBlocked}
          onClose={() => setShowBlock(false)}
        />
      )}

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Citas</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))]">Últimos 30 días + próximos 30 días</p>
          </div>
          <button
            onClick={() => setShowManual(true)}
            className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3"
          >
            <Plus size={14} /> Nueva cita
          </button>
          {workers[0] && (
            <button
              onClick={() => setShowBlock(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
            >
              <BanIcon size={13} /> Bloquear
            </button>
          )}
          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
          >
            <Download size={13} /> CSV
          </button>
        </div>

        {/* Horarios bloqueados */}
        {blockedSlots.length > 0 && (
          <div className="card p-4 mb-4">
            <h3 className="text-sm font-semibold text-[rgb(var(--fg))] mb-3 flex items-center gap-2">
              <BanIcon size={13} /> Horarios bloqueados
            </h3>
            <div className="flex flex-col gap-2">
              {blockedSlots.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-[rgb(var(--fg))]">
                      {formatDayLabel(b.starts_at)} · {format(parseISO(b.starts_at), 'HH:mm')}–{format(parseISO(b.ends_at), 'HH:mm')}
                    </p>
                    {b.reason && <p className="text-xs text-[rgb(var(--fg-secondary))] truncate">{b.reason}</p>}
                  </div>
                  <button
                    onClick={() => unblockAdmin(b.id)}
                    disabled={unblockingId === b.id}
                    className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:text-brand-red hover:bg-brand-red/10 transition-all shrink-0"
                    title="Desbloquear"
                  >
                    {unblockingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Búsqueda y filtros de worker */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-secondary))]" />
            <input
              className="input pl-8 w-full pr-8"
              placeholder="Cliente, teléfono o servicio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {workers.length > 1 && (
            <select
              className="input shrink-0"
              value={workerFilter}
              onChange={e => setWorkerFilter(e.target.value)}
            >
              <option value="all">Todos los barberos</option>
              {workers.map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Chips de estado con conteo — scroll horizontal en mobile */}
        <div className="-mx-4 px-4 overflow-x-auto mb-4">
        <div className="flex gap-2 min-w-max pb-0.5">
          {STATUS_CHIPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                statusFilter === key
                  ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] hover:border-[rgb(var(--fg-secondary))]/40'
              }`}
            >
              {label}
              <span className={`text-[10px] font-bold ${statusFilter === key ? 'text-brand-red' : 'text-[rgb(var(--fg-secondary))]'}`}>
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        </div>

        {/* Lista */}
        {grouped.length === 0 ? (
          <div className="card p-10 text-center">
            <Calendar size={36} className="text-[rgb(var(--fg-secondary))]/30 mx-auto mb-3" />
            <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay citas que coincidan</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.map(([day, appts]) => (
              <div key={day}>
                <p className="text-xs font-semibold text-[rgb(var(--fg-secondary))] uppercase tracking-wider mb-2 capitalize">
                  {formatDayLabel(`${day}T12:00:00`)}
                </p>
                <div className="card p-0 overflow-hidden">
                  {appts.map(appt => {
                    const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending_payment
                    const isLoading = loadingId === appt.id
                    const canAct =
                      (appt.status === 'confirmed' || appt.status === 'pending_payment') &&
                      new Date(appt.ends_at) > new Date()

                    const isSwiping = swipeDelta?.id === appt.id
                    const swipeX = swipeDelta && isSwiping ? swipeDelta.x : 0

                    return (
                      <div key={appt.id} className="relative overflow-hidden">
                        {appt.status === 'cancelled' && (
                          <div className="absolute inset-0 flex items-center justify-end px-5 bg-brand-red text-white">
                            <Trash2 size={16} />
                          </div>
                        )}
                        <div
                          onTouchStart={handleTouchStart(appt)}
                          onTouchMove={handleTouchMove(appt)}
                          onTouchEnd={handleTouchEnd(appt)}
                          style={{
                            transform: swipeX ? `translateX(${swipeX}px)` : undefined,
                            transition: isSwiping ? 'none' : 'transform 200ms ease-out',
                          }}
                          className="relative bg-[rgb(var(--bg))] flex items-start gap-2 px-4 py-3 border-b border-[rgb(var(--fg-secondary))]/10 last:border-0 text-sm flex-wrap"
                        >
                        {/* Hora */}
                        <b className="w-10 font-bold text-[rgb(var(--fg))] shrink-0">
                          {format(parseISO(appt.starts_at), 'HH:mm')}
                        </b>
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-xs font-bold shrink-0">
                          {appt.client_name?.charAt(0)}
                        </div>
                        {/* Info cliente */}
                        <div className="flex-1 min-w-[120px]">
                          <p className="font-semibold text-[rgb(var(--fg))] truncate">{appt.client_name}</p>
                          <p className="text-xs text-[rgb(var(--fg-secondary))] truncate">
                            {appt.services?.name}
                            {appt.workers?.name && ` · ${appt.workers.name}`}
                          </p>
                          {appt.client_phone && (
                            <a
                              href={`https://wa.me/${appt.client_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Phone size={10} /> {appt.client_phone}
                            </a>
                          )}
                        </div>
                        {/* Estado */}
                        <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color} shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {/* Precio */}
                        {appt.services?.price > 0 && (
                          <b className="text-xs shrink-0">
                            {formatPrice(appt.services.price)}
                          </b>
                        )}
                        {/* Acciones */}
                        {canAct && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => markComplete(appt)}
                              disabled={isLoading}
                              className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                            >
                              {isLoading
                                ? <Loader2 size={12} className="animate-spin" />
                                : appt.status === 'pending_payment' ? 'Confirmar' : 'Completar'}
                            </button>
                            <button
                              onClick={() => setCancelAppt(appt)}
                              disabled={isLoading}
                              className="btn-secondary text-xs py-1 px-3 hover:border-brand-red hover:text-brand-red"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
