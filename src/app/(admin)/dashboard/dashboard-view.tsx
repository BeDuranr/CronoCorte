'use client'

import { useState, useMemo } from 'react'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Calendar, TrendingUp, Scissors, Users, Clock,
  CheckCircle2, XCircle, AlertCircle, ChevronRight,
  ExternalLink, Copy, Plus, BarChart2
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  barbershop: {
    id: string
    name: string
    slug: string
    transfer_info: string | null
    agent_enabled: boolean
    agent_name: string | null
    agent_tone: string | null
  }
  todayAppointments: any[]
  weekStats: {
    totalAppointments: number
    revenue: number
    completedToday: number
  }
  workers: any[]
  adminName: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending_payment: { label: 'Pendiente pago', color: 'text-yellow-500', dot: 'bg-yellow-500' },
  confirmed:       { label: 'Confirmada',     color: 'text-green-500',  dot: 'bg-green-500'  },
  completed:       { label: 'Completada',     color: 'text-[rgb(var(--fg-secondary))]', dot: 'bg-[rgb(var(--fg-secondary))]' },
  cancelled:       { label: 'Cancelada',      color: 'text-brand-red',  dot: 'bg-brand-red'  },
}

// ── Panel "Requieren acción" ──────────────────────────────────────────────────
function ActionPanel({ appointments, onStatusChange }: { appointments: any[]; onStatusChange: () => void }) {
  const supabase = createClient()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const urgent = appointments.filter(
    a => a.status === 'pending_payment' && new Date(a.ends_at) > new Date()
  )
  if (urgent.length === 0) return null

  const confirmPayment = async (id: string) => {
    setLoadingId(id)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', id)
      if (error) throw error
      toast.success('Pago confirmado')
      onStatusChange()
    } catch { toast.error('Error al actualizar') }
    finally { setLoadingId(null) }
  }

  return (
    <div className="card p-4 border-yellow-500/30 mb-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-yellow-500 mb-3">
        <AlertCircle size={13} />
        Requieren acción · {urgent.length}
      </p>
      <div className="flex flex-col divide-y divide-[rgb(var(--fg-secondary))]/10">
        {urgent.map(appt => {
          const time = format(parseISO(appt.starts_at), 'HH:mm')
          return (
            <div key={appt.id} className="flex items-center gap-3 py-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[rgb(var(--fg))] truncate">{appt.client_name}</p>
                <p className="text-xs text-[rgb(var(--fg-secondary))]">
                  {time} · {appt.services?.name} · {appt.workers?.name}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => confirmPayment(appt.id)}
                  disabled={loadingId === appt.id}
                  className="btn-primary text-xs py-1 px-3"
                >
                  Confirmar pago
                </button>
                <Link
                  href="/dashboard/citas"
                  className="text-xs border border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] px-3 py-1 rounded-lg hover:border-[rgb(var(--fg-secondary))]/40 transition-all"
                >
                  Ver
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Timeline por barbero ─────────────────────────────────────────────────────
function TodayTimeline({ appointments, workers }: { appointments: any[]; workers: any[] }) {
  if (workers.length === 0 || appointments.length === 0) return null

  // Obtener citas de hoy
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const todayAppts = appointments.filter(
    a => new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) === todayKey
  )
  if (todayAppts.length === 0) return null

  // Horas únicas presentes hoy
  const hours = [...new Set(todayAppts.map(a => format(parseISO(a.starts_at), 'HH:00')))].sort()

  const statusColor: Record<string, string> = {
    pending_payment: 'border-l-yellow-500 bg-yellow-500/5',
    confirmed: 'border-l-green-500 bg-green-500/5',
    completed: 'border-l-[rgb(var(--fg-secondary))]/30 opacity-50',
    cancelled: 'border-l-brand-red',
  }

  return (
    <div className="card p-4 overflow-x-auto">
      <div
        className="grid text-xs min-w-max"
        style={{ gridTemplateColumns: `44px repeat(${workers.length}, minmax(120px, 1fr))` }}
      >
        {/* Header */}
        <div />
        {workers.map(w => (
          <div key={w.id} className="font-semibold text-[rgb(var(--fg))] px-2 pb-2 border-b border-[rgb(var(--fg-secondary))]/10">
            {w.name}
          </div>
        ))}

        {/* Rows */}
        {hours.map(hr => (
          <>
            <div key={`hr-${hr}`} className="text-[rgb(var(--fg-secondary))] text-right pr-2 pt-2 border-r border-[rgb(var(--fg-secondary))]/10">
              {hr}
            </div>
            {workers.map(w => {
              const appt = todayAppts.find(
                a => a.workers?.name === w.name && format(parseISO(a.starts_at), 'HH:00') === hr
              )
              return (
                <div key={`${hr}-${w.id}`} className="px-2 pt-2 pb-1 border-l border-[rgb(var(--fg-secondary))]/10 first:border-l-0">
                  {appt ? (
                    <div className={`border-l-2 pl-2 py-1 rounded-r-lg ${statusColor[appt.status] ?? 'border-l-[rgb(var(--fg-secondary))]/20'}`}>
                      <p className="font-medium text-[rgb(var(--fg))] truncate">{appt.client_name}</p>
                      <p className="text-[rgb(var(--fg-secondary))] truncate">{appt.services?.name}</p>
                    </div>
                  ) : (
                    <div className="border border-dashed border-[rgb(var(--fg-secondary))]/20 rounded-lg py-1 px-2 text-[rgb(var(--fg-secondary))]">
                      Libre
                    </div>
                  )}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ── Appointment card ─────────────────────────────────────────────────────────
function AppointmentCard({ appt, onStatusChange }: { appt: any; onStatusChange: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending_payment

  const markComplete = async () => {
    const newStatus = appt.status === 'pending_payment' ? 'confirmed' : 'completed'
    setLoading(true)
    try {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appt.id)
      if (error) throw error
      toast.success(newStatus === 'confirmed' ? 'Pago confirmado' : 'Marcado como completado')
      onStatusChange()
    } catch { toast.error('Error al actualizar') }
    finally { setLoading(false) }
  }

  const cancel = async () => {
    if (!confirm('¿Cancelar esta cita?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
      if (error) throw error
      toast.success('Cita cancelada')
      onStatusChange()
    } catch { toast.error('Error al cancelar') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--fg-secondary))]/10 last:border-0 text-sm">
      <b className="w-10 shrink-0 font-bold text-[rgb(var(--fg))]">
        {format(parseISO(appt.starts_at), 'HH:mm')}
      </b>
      <div className="w-7 h-7 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-xs font-bold shrink-0">
        {appt.client_name?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[rgb(var(--fg))] truncate">{appt.client_name}</p>
        <p className="text-xs text-[rgb(var(--fg-secondary))] truncate">
          {appt.services?.name} · {appt.workers?.name}
        </p>
      </div>
      <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color} shrink-0`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
      {appt.services?.price && (
        <b className="text-xs shrink-0">{formatPrice(appt.services.price)}</b>
      )}
      {(appt.status === 'confirmed' || appt.status === 'pending_payment') &&
       new Date(appt.ends_at) > new Date() && (
        <button
          onClick={markComplete}
          disabled={loading}
          className="btn-primary text-xs py-1 px-3 shrink-0"
        >
          {appt.status === 'pending_payment' ? 'Confirmar' : 'Completar'}
        </button>
      )}
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export function DashboardView({ barbershop, todayAppointments, weekStats, workers, adminName }: Props) {
  const [appointments, setAppointments] = useState(todayAppointments)
  const supabase = createClient()
  const [linkCopied, setLinkCopied] = useState(false)

  const refresh = async () => {
    const future = new Date()
    future.setDate(future.getDate() + 60)
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, client_name, starts_at, ends_at, status, payment_verified,
        services(name, price, duration_minutes),
        workers(name)
      `)
      .eq('barbershop_id', barbershop.id)
      .gte('starts_at', new Date().toISOString())
      .lte('starts_at', future.toISOString())
      .not('status', 'eq', 'cancelled')
      .order('starts_at', { ascending: true })
    if (data) setAppointments(data as any[])
  }

  const dayKeyChile = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    appointments.forEach(a => {
      const day = dayKeyChile(a.starts_at)
      if (!map[day]) map[day] = []
      map[day].push(a)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [appointments])

  const formatDayLabel = (dateStr: string) => {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'Hoy'
    if (isTomorrow(d)) return 'Mañana'
    return format(d, "EEEE d 'de' MMMM", { locale: es })
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const todayCount = appointments.filter(
    a => dayKeyChile(a.starts_at) === dayKeyChile(new Date().toISOString())
  ).length

  const copyLink = () => {
    const url = `${window.location.origin}/${barbershop.slug}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
    toast.success('Link copiado')
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[rgb(var(--fg))]">
            {greeting()}, {adminName.split(' ')[0]}
          </h1>
          <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
          <Link
            href="/dashboard/citas?nuevo=1"
            className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
          >
            <Plus size={14} /> Cita manual
          </Link>
          <a
            href={`/${barbershop.slug}`}
            target="_blank"
            className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
          >
            <ExternalLink size={13} /> Ver página
          </a>
        </div>
      </div>

      {/* Panel "Requieren acción" */}
      <ActionPanel appointments={appointments} onStatusChange={refresh} />

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            icon: Calendar,
            label: 'Citas hoy',
            value: todayCount,
            color: 'text-blue-500',
          },
          {
            icon: CheckCircle2,
            label: 'Esta semana',
            value: weekStats.totalAppointments,
            color: 'text-green-500',
          },
          {
            icon: TrendingUp,
            label: 'Ingresos semana',
            value: formatPrice(weekStats.revenue),
            color: 'text-brand-red',
          },
          {
            icon: Scissors,
            label: 'Completados hoy',
            value: weekStats.completedToday,
            color: 'text-[rgb(var(--fg-secondary))]',
          },
        ].map((stat, i) => (
          <div key={i} className="card p-4">
            <div className={`${stat.color} mb-2`}>
              <stat.icon size={18} />
            </div>
            <p className="text-xl font-bold text-[rgb(var(--fg))]">{stat.value}</p>
            <p className="text-xs text-[rgb(var(--fg-secondary))] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Agenda */}
        <div className="lg:col-span-2">
          {/* Timeline hoy */}
          {workers.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[rgb(var(--fg))] flex items-center gap-1.5">
                  <BarChart2 size={15} className="text-[rgb(var(--fg-secondary))]" />
                  Hoy por barbero
                </h2>
                <Link
                  href="/dashboard/citas"
                  className="text-xs text-brand-red hover:underline flex items-center gap-1"
                >
                  Ver todas <ChevronRight size={12} />
                </Link>
              </div>
              <TodayTimeline appointments={appointments} workers={workers} />
            </div>
          )}

          {/* Próximas citas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[rgb(var(--fg))]">Próximas citas</h2>
              {workers.length === 0 && (
                <Link href="/dashboard/citas" className="text-xs text-brand-red hover:underline flex items-center gap-1">
                  Ver todas <ChevronRight size={12} />
                </Link>
              )}
            </div>

            {grouped.length === 0 ? (
              <div className="card p-8 text-center">
                <Calendar size={32} className="text-[rgb(var(--fg-secondary))]/40 mx-auto mb-3" />
                <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay citas próximas</p>
                <a
                  href={`/${barbershop.slug}`}
                  target="_blank"
                  className="text-brand-red text-sm hover:underline mt-2 inline-block"
                >
                  Comparte tu link de reserva →
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {grouped.map(([day, appts]) => (
                  <div key={day}>
                    <p className="text-xs font-semibold text-[rgb(var(--fg-secondary))] uppercase tracking-wider mb-2 capitalize">
                      {formatDayLabel(`${day}T12:00:00`)}
                    </p>
                    <div className="card p-0 overflow-hidden">
                      {appts.map(appt => (
                        <AppointmentCard key={appt.id} appt={appt} onStatusChange={refresh} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Link de reservas */}
          <div className="card p-4">
            <p className="text-xs text-[rgb(var(--fg-secondary))] mb-2">Link de reservas</p>
            <button onClick={copyLink} className="w-full text-left group">
              <code className="text-xs bg-[rgb(var(--bg-secondary))] px-2 py-1.5 rounded flex items-center justify-between text-brand-red hover:bg-brand-red/10 transition-colors">
                <span className="truncate">/{barbershop.slug}</span>
                {linkCopied ? <CheckCircle2 size={12} className="text-green-500 shrink-0" /> : <Copy size={12} className="shrink-0 opacity-60" />}
              </code>
            </button>
          </div>

          {/* Barberos */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-[rgb(var(--fg))] flex items-center gap-1.5">
                <Users size={14} /> Barberos
              </h3>
              <Link href="/dashboard/barberos" className="text-xs text-brand-red hover:underline">
                Gestionar
              </Link>
            </div>
            {workers.length === 0 ? (
              <p className="text-xs text-[rgb(var(--fg-secondary))]">
                No hay barberos.{' '}
                <Link href="/dashboard/barberos" className="text-brand-red hover:underline">
                  Invitar →
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {workers.map(w => (
                  <div key={w.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-xs font-bold">
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[rgb(var(--fg))]">{w.name}</p>
                      {w.specialty && (
                        <p className="text-xs text-[rgb(var(--fg-secondary))]">{w.specialty}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accesos rápidos */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-[rgb(var(--fg))] mb-3">Secciones</h3>
            <div className="flex flex-col">
              {[
                { href: '/dashboard/citas',        label: 'Citas',          icon: Calendar },
                { href: '/dashboard/barberos',     label: 'Barberos',       icon: Users },
                { href: '/dashboard/servicios',    label: 'Servicios',      icon: Scissors },
                { href: '/dashboard/configuracion',label: 'Configuración',  icon: null },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between px-2 py-2 rounded-lg text-sm
                             text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))]
                             hover:bg-[rgb(var(--bg-secondary))] transition-all"
                >
                  <span className="flex items-center gap-2">
                    {Icon && <Icon size={13} />}
                    {label}
                  </span>
                  <ChevronRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
