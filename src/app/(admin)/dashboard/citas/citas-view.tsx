'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Loader2, ChevronLeft, Phone, Download, X
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  barbershopId: string
  appointments: any[]
  workers: { id: string; name: string }[]
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

// ── Vista de citas ────────────────────────────────────────────────────────────
export function CitasView({ barbershopId, appointments: initial, workers }: Props) {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancelAppt, setCancelAppt] = useState<any | null>(null)

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
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('id', id)
    if (error) {
      toast.error('Error al cancelar')
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
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
          >
            <Download size={13} /> CSV
          </button>
        </div>

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

                    return (
                      <div key={appt.id} className="flex items-start gap-2 px-4 py-3 border-b border-[rgb(var(--fg-secondary))]/10 last:border-0 text-sm flex-wrap">
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
