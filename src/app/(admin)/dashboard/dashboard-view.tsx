'use client'

import { useState } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Calendar, TrendingUp, Scissors, Users, Clock,
  CheckCircle2, XCircle, AlertCircle, ChevronRight,
  ExternalLink
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_payment: { label: 'Pendiente pago', color: 'text-yellow-500', icon: AlertCircle },
  confirmed: { label: 'Confirmada', color: 'text-green-500', icon: CheckCircle2 },
  completed: { label: 'Completada', color: 'text-[rgb(var(--fg-secondary))]', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', color: 'text-brand-red', icon: XCircle },
}

function AppointmentCard({ appt, onStatusChange }: { appt: any; onStatusChange: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending_payment
  const Icon = cfg.icon

  const markComplete = async () => {
    const newStatus = appt.status === 'pending_payment' ? 'confirmed' : 'completed'
    setLoading(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appt.id)
      if (error) throw error
      toast.success(newStatus === 'confirmed' ? 'Pago confirmado' : 'Marcado como completado')
      onStatusChange()
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async () => {
    if (!confirm('¿Cancelar esta cita?')) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id)
      if (error) throw error
      toast.success('Cita cancelada')
      onStatusChange()
    } catch {
      toast.error('Error al cancelar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[rgb(var(--fg))]">{appt.client_name}</p>
          <p className="text-sm text-[rgb(var(--fg-secondary))]">
            {appt.services?.name} · {appt.workers?.name}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
          <Icon size={12} />
          {cfg.label}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-[rgb(var(--fg-secondary))]">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {format(parseISO(appt.starts_at), 'HH:mm')} – {format(parseISO(appt.ends_at), 'HH:mm')}
        </span>
        {appt.services?.price && (
          <span className="font-medium text-[rgb(var(--fg))]">
            {formatPrice(appt.services.price)}
          </span>
        )}
        {appt.payment_verified && (
          <span className="text-green-500 text-xs">✓ Pago verificado</span>
        )}
      </div>

      {(appt.status === 'confirmed' || appt.status === 'pending_payment') && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={markComplete}
            disabled={loading}
            className="btn-primary text-xs py-1 px-3"
          >
            {appt.status === 'pending_payment' ? 'Confirmar pago' : 'Marcar completado'}
          </button>
          <button
            onClick={cancel}
            disabled={loading}
            className="btn-secondary text-xs py-1 px-3 hover:border-brand-red hover:text-brand-red"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

export function DashboardView({ barbershop, todayAppointments, weekStats, workers, adminName }: Props) {
  const [appointments, setAppointments] = useState(todayAppointments)
  const supabase = createClient()

  const refresh = async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('appointments')
      .select(`
        id, client_name, starts_at, ends_at, status, payment_verified,
        services(name, price, duration_minutes),
        workers(name)
      `)
      .eq('barbershop_id', barbershop.id)
      .gte('starts_at', `${todayStr}T00:00:00`)
      .lte('starts_at', `${todayStr}T23:59:59`)
      .not('status', 'eq', 'cancelled')
      .order('starts_at', { ascending: true })

    if (data) setAppointments(data as any[])
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">
          {greeting()}, {adminName.split(' ')[0]}
        </h1>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mt-1">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })} ·{' '}
          <a
            href={`/${barbershop.slug}`}
            target="_blank"
            className="text-brand-red hover:underline inline-flex items-center gap-1"
          >
            Ver página pública <ExternalLink size={10} />
          </a>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            icon: Calendar,
            label: 'Citas hoy',
            value: appointments.length,
            color: 'text-blue-500',
          },
          {
            icon: CheckCircle2,
            label: 'Completadas',
            value: appointments.filter(a => a.status === 'completed').length,
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
            label: 'Cortes semana',
            value: weekStats.totalAppointments,
            color: 'text-[rgb(var(--fg-secondary))]',
          },
        ].map((stat, i) => (
          <div key={i} className="card p-4">
            <div className={`${stat.color} mb-2`}>
              <stat.icon size={18} />
            </div>
            <p className="text-2xl font-bold text-[rgb(var(--fg))]">{stat.value}</p>
            <p className="text-xs text-[rgb(var(--fg-secondary))] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Today's agenda */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[rgb(var(--fg))]">Agenda de hoy</h2>
            <Link
              href="/dashboard/citas"
              className="text-xs text-brand-red hover:underline flex items-center gap-1"
            >
              Ver todas <ChevronRight size={12} />
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="card p-8 text-center">
              <Calendar size={32} className="text-[rgb(var(--fg-secondary))]/40 mx-auto mb-3" />
              <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay citas para hoy</p>
              <a
                href={`/${barbershop.slug}`}
                target="_blank"
                className="text-brand-red text-sm hover:underline mt-2 inline-block"
              >
                Comparte tu link de reserva →
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {appointments.map(appt => (
                <AppointmentCard key={appt.id} appt={appt} onStatusChange={refresh} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Workers */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-[rgb(var(--fg))]">
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  Barberos
                </span>
              </h3>
              <Link href="/dashboard/barberos" className="text-xs text-brand-red hover:underline">
                Gestionar
              </Link>
            </div>
            {workers.length === 0 ? (
              <p className="text-xs text-[rgb(var(--fg-secondary))]">
                No hay barberos activos.{' '}
                <Link href="/dashboard/barberos" className="text-brand-red hover:underline">
                  Agregar →
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

          {/* Quick links */}
          <div className="card p-4">
            <h3 className="font-semibold text-sm text-[rgb(var(--fg))] mb-3">Accesos rápidos</h3>
            <div className="flex flex-col gap-2">
              {[
                { href: '/dashboard/servicios', label: 'Gestionar servicios', icon: Scissors },
                { href: '/dashboard/configuracion', label: 'Configuración', icon: null },
                {
                  href: `/${barbershop.slug}`,
                  label: 'Ver página de reservas',
                  icon: ExternalLink,
                  external: true,
                },
              ].map(({ href, label, icon: Icon, external }) => (
                <Link
                  key={href}
                  href={href}
                  target={external ? '_blank' : undefined}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm
                             text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))]
                             hover:bg-[rgb(var(--bg-secondary))] transition-all"
                >
                  {label}
                  <ChevronRight size={14} />
                </Link>
              ))}
            </div>
          </div>

          {/* Booking link */}
          <div className="card p-4 border-brand-red/20">
            <p className="text-xs text-[rgb(var(--fg-secondary))] mb-2">Tu link de reservas:</p>
            <code className="text-xs bg-[rgb(var(--bg-secondary))] px-2 py-1 rounded text-brand-red block truncate">
              cronocorte.app/{barbershop.slug}
            </code>
          </div>
        </div>
      </div>
    </main>
  )
}
