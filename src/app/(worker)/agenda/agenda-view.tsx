'use client'

import { useState } from 'react'
import { format, parseISO, addDays, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Calendar, TrendingUp, Scissors, Clock, CheckCircle2,
  AlertCircle, ChevronLeft, ChevronRight, Phone, ExternalLink,
  Link as LinkIcon
} from 'lucide-react'

interface Worker {
  id: string
  name: string
  specialty: string | null
  barbershop_id: string
  calendar_token: string | null
  barbershop: { name: string; slug: string }
}

interface Props {
  worker: Worker
  todayAppointments: any[]
  weekStats: { total: number; completed: number; revenue: number }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pendiente pago', color: 'text-yellow-500' },
  confirmed: { label: 'Confirmada', color: 'text-green-500' },
  completed: { label: 'Completada', color: 'text-[rgb(var(--fg-secondary))]' },
  cancelled: { label: 'Cancelada', color: 'text-brand-red' },
}

function AppointmentItem({ appt, onMark }: { appt: any; onMark: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const cfg = STATUS_LABELS[appt.status] ?? STATUS_LABELS.pending_payment

  const markDone = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appt.id)
      if (error) throw error
      toast.success('Marcado como completado')
      onMark(appt.id)
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  const startTime = format(parseISO(appt.starts_at), 'HH:mm')
  const endTime = format(parseISO(appt.ends_at), 'HH:mm')

  return (
    <div className="flex gap-4">
      {/* Time column */}
      <div className="flex flex-col items-center w-14 shrink-0">
        <span className="text-sm font-bold text-[rgb(var(--fg))]">{startTime}</span>
        <div className="w-px flex-1 bg-[rgb(var(--fg-secondary))]/20 my-1" />
        <span className="text-xs text-[rgb(var(--fg-secondary))]">{endTime}</span>
      </div>

      {/* Content */}
      <div
        className={`card flex-1 p-3 mb-3 border-l-2 transition-all ${
          appt.status === 'confirmed' ? 'border-l-green-500' :
          appt.status === 'pending_payment' ? 'border-l-yellow-500' :
          appt.status === 'completed' ? 'border-l-[rgb(var(--fg-secondary))]/30' :
          'border-l-brand-red'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <p className="font-semibold text-[rgb(var(--fg))]">{appt.client_name}</p>
            <p className="text-sm text-[rgb(var(--fg-secondary))]">{appt.services?.name}</p>
          </div>
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[rgb(var(--fg-secondary))] mt-1">
          {appt.client_phone && (
            <a
              href={`https://wa.me/${appt.client_phone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              className="flex items-center gap-1 hover:text-green-500 transition-colors"
            >
              <Phone size={10} /> {appt.client_phone}
            </a>
          )}
          {appt.services?.price && (
            <span className="font-medium text-[rgb(var(--fg))]">
              {formatPrice(appt.services.price)}
            </span>
          )}
        </div>

        {appt.recommended_style && (
          <p className="text-xs text-brand-red mt-1">✦ Estilo recomendado: {appt.recommended_style}</p>
        )}

        {appt.notes && (
          <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1 italic">"{appt.notes}"</p>
        )}

        {appt.status === 'confirmed' && (
          <button
            onClick={markDone}
            disabled={loading}
            className="mt-2 btn-primary text-xs py-1 px-3"
          >
            <CheckCircle2 size={12} className="inline mr-1" />
            Marcar completado
          </button>
        )}
      </div>
    </div>
  )
}

// Week calendar strip
function WeekStrip({ selectedDate, onSelect }: { selectedDate: Date; onSelect: (d: Date) => void }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const base = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(base, i))
  const today = new Date()

  return (
    <div className="card p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-[rgb(var(--fg-secondary))]">
          {format(base, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
          const isTdy = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all ${
                isSelected
                  ? 'bg-brand-red text-white'
                  : isTdy
                  ? 'bg-brand-red/10 text-brand-red'
                  : 'hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]'
              }`}
            >
              <span className="text-[10px] font-medium uppercase">
                {format(day, 'EEE', { locale: es }).slice(0, 2)}
              </span>
              <span className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-white' : ''}`}>
                {format(day, 'd')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AgendaView({ worker, todayAppointments, weekStats }: Props) {
  const supabase = createClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState(todayAppointments)
  const [loadingDate, setLoadingDate] = useState(false)

  const selectDate = async (date: Date) => {
    setSelectedDate(date)
    setLoadingDate(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, client_name, client_phone, starts_at, ends_at, status, notes, recommended_style,
          services(name, price, duration_minutes)
        `)
        .eq('worker_id', worker.id)
        .gte('starts_at', `${dateStr}T00:00:00`)
        .lte('starts_at', `${dateStr}T23:59:59`)
        .not('status', 'eq', 'cancelled')
        .order('starts_at', { ascending: true })

      setAppointments((data as any[]) ?? [])
    } finally {
      setLoadingDate(false)
    }
  }

  const handleMark = (id: string) => {
    setAppointments(a => a.map(apt => apt.id === id ? { ...apt, status: 'completed' } : apt))
  }

  const calendarUrl = worker.calendar_token
    ? `webcal://${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '')}/api/calendar/${worker.calendar_token}`
    : null

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Mi Agenda</h1>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
          {worker.barbershop?.name}
          {worker.specialty && ` · ${worker.specialty}`}
        </p>
      </div>

      {/* Week stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { icon: Scissors, label: 'Cortes semana', value: weekStats.total, color: 'text-brand-red' },
          { icon: CheckCircle2, label: 'Completados', value: weekStats.completed, color: 'text-green-500' },
          { icon: TrendingUp, label: 'Ingresos', value: formatPrice(weekStats.revenue), color: 'text-[rgb(var(--fg))]' },
        ].map((s, i) => (
          <div key={i} className="card p-3 text-center">
            <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
            <p className="text-lg font-bold text-[rgb(var(--fg))]">{s.value}</p>
            <p className="text-[10px] text-[rgb(var(--fg-secondary))]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Week strip */}
      <WeekStrip selectedDate={selectedDate} onSelect={selectDate} />

      {/* Selected day */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-[rgb(var(--fg))]">
          {isToday ? 'Hoy' : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
        </h2>
        <span className="text-sm text-[rgb(var(--fg-secondary))]">
          {appointments.length} {appointments.length === 1 ? 'cita' : 'citas'}
        </span>
      </div>

      {loadingDate ? (
        <div className="text-center py-10">
          <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-8 text-center">
          <Calendar size={28} className="text-[rgb(var(--fg-secondary))]/40 mx-auto mb-2" />
          <p className="text-sm text-[rgb(var(--fg-secondary))]">Sin citas para este día</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {appointments.map(appt => (
            <AppointmentItem key={appt.id} appt={appt} onMark={handleMark} />
          ))}
        </div>
      )}

      {/* Calendar sync */}
      {calendarUrl && (
        <div className="card p-4 mt-6">
          <h3 className="text-sm font-semibold text-[rgb(var(--fg))] mb-2 flex items-center gap-2">
            <Calendar size={14} />
            Sincronizar con calendario
          </h3>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mb-3">
            Agrega tu agenda a Apple Calendar o Google Calendar automáticamente.
          </p>
          <a
            href={calendarUrl}
            className="btn-secondary text-xs py-2 flex items-center gap-2 justify-center"
          >
            <LinkIcon size={12} />
            Suscribir a Apple Calendar
          </a>
          <p className="text-[10px] text-[rgb(var(--fg-secondary))]/60 mt-2 text-center">
            Para Google Calendar: copia el link y pégalo en "Otras agendas → Desde URL"
          </p>
          <code className="text-[10px] bg-[rgb(var(--bg-secondary))] block px-2 py-1 rounded mt-1 break-all text-[rgb(var(--fg-secondary))]">
            {calendarUrl.replace('webcal://', 'https://')}
          </code>
        </div>
      )}
    </main>
  )
}
