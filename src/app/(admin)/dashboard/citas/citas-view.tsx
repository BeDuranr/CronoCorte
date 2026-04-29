'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, Loader2, ChevronLeft, Phone
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  barbershopId: string
  appointments: any[]
  workers: { id: string; name: string }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending_payment: { label: 'Pendiente pago', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: AlertCircle },
  confirmed:       { label: 'Confirmada',      color: 'text-green-500',  bg: 'bg-green-500/10',  icon: CheckCircle2 },
  completed:       { label: 'Completada',      color: 'text-[rgb(var(--fg-secondary))]', bg: 'bg-[rgb(var(--bg-secondary))]', icon: CheckCircle2 },
  cancelled:       { label: 'Cancelada',       color: 'text-brand-red',  bg: 'bg-brand-red/10',  icon: XCircle },
}

function formatDayLabel(dateStr: string) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  if (isYesterday(d)) return 'Ayer'
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

export function CitasView({ barbershopId, appointments: initial, workers }: Props) {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<any[]>(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)

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

  // Group by day
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    filtered.forEach(a => {
      const day = a.starts_at.slice(0, 10)
      if (!map[day]) map[day] = []
      map[day].push(a)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)) // newest first
  }, [filtered])

  const updateStatus = async (id: string, status: string) => {
    setLoadingId(id)
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
    if (error) {
      toast.error('Error al actualizar')
    } else {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      toast.success('Cita actualizada')
    }
    setLoadingId(null)
  }

  const cancel = async (id: string, name: string) => {
    if (!confirm(`¿Cancelar la cita de ${name}?`)) return
    await updateStatus(id, 'cancelled')
  }

  const markComplete = async (appt: any) => {
    const newStatus = appt.status === 'pending_payment' ? 'confirmed' : 'completed'
    await updateStatus(appt.id, newStatus)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Todas las citas</h1>
          <p className="text-sm text-[rgb(var(--fg-secondary))]">Últimos 30 días + próximos 30 días</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-secondary))]" />
          <input
            className="input pl-8 w-full"
            placeholder="Buscar cliente, servicio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input shrink-0"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="pending_payment">Pendiente pago</option>
          <option value="confirmed">Confirmadas</option>
          <option value="completed">Completadas</option>
          <option value="cancelled">Canceladas</option>
        </select>
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

      {/* Count */}
      <p className="text-xs text-[rgb(var(--fg-secondary))] mb-4">
        {filtered.length} cita{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* List */}
      {grouped.length === 0 ? (
        <div className="card p-10 text-center">
          <Calendar size={36} className="text-[rgb(var(--fg-secondary))]/30 mx-auto mb-3" />
          <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay citas que coincidan</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([day, appts]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-[rgb(var(--fg-secondary))] uppercase tracking-wider mb-2 capitalize">
                {formatDayLabel(`${day}T12:00:00`)}
              </p>
              <div className="flex flex-col gap-2">
                {appts.map(appt => {
                  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending_payment
                  const Icon = cfg.icon
                  const isLoading = loadingId === appt.id
                  const canAct =
                    (appt.status === 'confirmed' || appt.status === 'pending_payment') &&
                    new Date(appt.ends_at) > new Date()

                  return (
                    <div key={appt.id} className="card p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[rgb(var(--fg))] truncate">{appt.client_name}</p>
                          <p className="text-sm text-[rgb(var(--fg-secondary))] truncate">
                            {appt.services?.name}
                            {appt.workers?.name && ` · ${appt.workers.name}`}
                          </p>
                          {appt.client_phone && (
                            <a
                              href={`https://wa.me/${appt.client_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              className="text-xs text-brand-red hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Phone size={10} /> {appt.client_phone}
                            </a>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0 ${cfg.color} ${cfg.bg}`}>
                          <Icon size={11} />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-[rgb(var(--fg-secondary))]">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {format(parseISO(appt.starts_at), 'HH:mm')} – {format(parseISO(appt.ends_at), 'HH:mm')}
                        </span>
                        {appt.services?.price > 0 && (
                          <span className="font-medium text-[rgb(var(--fg))]">
                            {formatPrice(appt.services.price)}
                          </span>
                        )}
                        {appt.payment_verified && (
                          <span className="text-green-500 text-xs">✓ Pago verificado</span>
                        )}
                      </div>

                      {appt.notes && (
                        <p className="text-xs text-[rgb(var(--fg-secondary))]/70 italic truncate">
                          {appt.notes}
                        </p>
                      )}

                      {canAct && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => markComplete(appt)}
                            disabled={isLoading}
                            className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                          >
                            {isLoading
                              ? <Loader2 size={12} className="animate-spin" />
                              : appt.status === 'pending_payment' ? 'Confirmar pago' : 'Marcar completado'}
                          </button>
                          <button
                            onClick={() => cancel(appt.id, appt.client_name)}
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
  )
}
