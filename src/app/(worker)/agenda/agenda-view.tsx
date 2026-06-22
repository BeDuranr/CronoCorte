'use client'

import { useState } from 'react'
import { format, parseISO, addDays, startOfWeek, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Calendar, TrendingUp, Scissors, CheckCircle2,
  ChevronLeft, ChevronRight, Phone, Link as LinkIcon,
  BanIcon, Loader2, X, Trash2
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

const STATUS_COLOR: Record<string, string> = {
  pending_payment: 'border-l-yellow-500',
  confirmed: 'border-l-green-500',
  completed: 'opacity-50 border-l-[rgb(var(--fg-secondary))]',
  cancelled: 'border-l-brand-red opacity-40',
  blocked: 'border-l-[rgb(var(--fg-secondary))]/40',
}

// ── Tira de días de la semana ────────────────────────────────────────────────
function WeekStrip({ selectedDate, onSelect }: { selectedDate: Date; onSelect: (d: Date) => void }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const base = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(base, i))
  const today = new Date()

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] transition-all">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-medium text-[rgb(var(--fg-secondary))] capitalize">
          {format(base, 'MMMM yyyy', { locale: es })}
        </span>
        <button onClick={() => setWeekOffset(o => o + 1)} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] transition-all">
          <ChevronRight size={15} />
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
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
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
              <span className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-[rgb(var(--fg))]'}`}>
                {format(day, 'd')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Hueco libre entre citas ──────────────────────────────────────────────────
function FreeSlot({
  startTime,
  durationMin,
  onBlock,
}: {
  startTime: string
  durationMin: number
  onBlock: (time: string, maxMin: number) => void
}) {
  return (
    <div className="flex gap-3 items-center">
      <span className="text-[10.5px] text-[rgb(var(--fg-secondary))] w-10 shrink-0 pt-2">{startTime}</span>
      <div className="flex-1 border border-dashed border-[rgb(var(--fg-secondary))]/30 rounded-xl px-3 py-2.5 flex items-center justify-between mb-3">
        <span className="text-xs text-[rgb(var(--fg-secondary))]">Hueco · {durationMin} min</span>
        <button
          onClick={() => onBlock(startTime, durationMin)}
          className="flex items-center gap-1 text-[10.5px] border border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] px-2 py-1 rounded-full hover:border-brand-red hover:text-brand-red transition-all"
        >
          <BanIcon size={9} /> Bloquear
        </button>
      </div>
    </div>
  )
}

// ── Modal de bloqueo ─────────────────────────────────────────────────────────
function BlockModal({
  time,
  maxMin,
  onConfirm,
  onClose,
}: {
  time: string
  maxMin: number
  onConfirm: (durationMin: number, reason: string) => Promise<void>
  onClose: () => void
}) {
  const BASE_PRESETS = [30, 45, 60, 90]
  const presets = Array.from(new Set([...BASE_PRESETS.filter(p => p < maxMin), maxMin])).sort((a, b) => a - b)
  const [duration, setDuration] = useState(maxMin)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm(duration, reason)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BanIcon size={14} className="text-[rgb(var(--fg-secondary))]" />
            <b className="text-sm text-[rgb(var(--fg))]">Bloquear · desde {time}</b>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]">
            <X size={14} />
          </button>
        </div>

        <p className="label mb-2">Duración</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setDuration(p)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                duration === p
                  ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] hover:border-[rgb(var(--fg-secondary))]/40'
              }`}
            >
              {p === maxMin ? `${p} min (todo el hueco)` : `${p} min`}
            </button>
          ))}
        </div>

        <p className="label mb-2">Motivo (opcional)</p>
        <input
          className="input w-full mb-5"
          placeholder="Ej: Descanso, reunión, corte propio..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn-primary text-sm py-1.5 px-4 bg-brand-red hover:bg-[#bd2f39] flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <><BanIcon size={13} /> Bloquear</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de cita ──────────────────────────────────────────────────────────
function AppointmentItem({ appt, isNext, onMark, onUnblock }: { appt: any; isNext?: boolean; onMark: (id: string) => void; onUnblock: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [unblocking, setUnblocking] = useState(false)
  const supabase = createClient()

  // ── Render especial para bloqueos ───────────────────────────────────────────
  if (appt.status === 'blocked') {
    const startTime = format(parseISO(appt.starts_at), 'HH:mm')
    const endTime = format(parseISO(appt.ends_at), 'HH:mm')
    const handleUnblock = async () => {
      setUnblocking(true)
      const { error } = await supabase.from('appointments').delete().eq('id', appt.id)
      if (error) { toast.error('Error al desbloquear'); setUnblocking(false); return }
      toast.success('Horario desbloqueado')
      onUnblock(appt.id)
    }
    return (
      <div className="flex gap-3">
        <span className="text-[10.5px] text-[rgb(var(--fg-secondary))] w-10 shrink-0 pt-3">{startTime}</span>
        <div className="card flex-1 p-3 mb-3 border-l-[3px] border-l-[rgb(var(--fg-secondary))]/30 opacity-70">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BanIcon size={12} className="text-[rgb(var(--fg-secondary))] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[rgb(var(--fg-secondary))]">
                  Bloqueado · {startTime}–{endTime}
                </p>
                {appt.client_name && appt.client_name !== 'Bloqueado' && (
                  <p className="text-xs text-[rgb(var(--fg-secondary))] truncate">{appt.client_name}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleUnblock}
              disabled={unblocking}
              className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:text-brand-red hover:bg-brand-red/10 transition-all shrink-0"
              title="Desbloquear"
            >
              {unblocking ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const markDone = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', appt.id)
      if (error) throw error
      toast.success('¡Listo!')
      onMark(appt.id)
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  const startTime = format(parseISO(appt.starts_at), 'HH:mm')

  return (
    <div className="flex gap-3">
      <span className="text-[10.5px] text-[rgb(var(--fg-secondary))] w-10 shrink-0 pt-3">{startTime}</span>
      <div
        className={`card flex-1 p-3 mb-3 border-l-[3px] transition-all ${STATUS_COLOR[appt.status] ?? 'border-l-brand-red'} ${
          isNext ? 'border-brand-red shadow-sm' : ''
        }`}
      >
        {isNext && (
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-red mb-1.5">
            Siguiente · en{' '}
            {Math.round(differenceInMinutes(parseISO(appt.starts_at), new Date()))} min
          </p>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[rgb(var(--fg))] truncate">{appt.client_name}</p>
            <p className="text-xs text-[rgb(var(--fg-secondary))] truncate">
              {appt.services?.name}
              {appt.services?.price > 0 && ` · ${formatPrice(appt.services.price)}`}
            </p>
            {appt.notes && (
              <p className="text-[10.5px] text-[rgb(var(--fg-secondary))] italic mt-0.5">"{appt.notes}"</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {appt.client_phone && (
              <a
                href={`https://wa.me/${appt.client_phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:text-green-500 hover:bg-green-500/10 transition-all"
              >
                <Phone size={13} />
              </a>
            )}
            {(appt.status === 'confirmed' || appt.status === 'pending_payment') && (
              <button
                onClick={markDone}
                disabled={loading}
                className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Listo
              </button>
            )}
            {appt.status === 'completed' && (
              <span className="text-xs text-[rgb(var(--fg-secondary))] font-medium">Hecho</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Build timeline: intercala huecos libres entre citas ──────────────────────
function buildTimeline(appts: any[]) {
  if (appts.length === 0) return []

  const sorted = [...appts].sort((a, b) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  )

  const result: Array<{ type: 'appt'; appt: any } | { type: 'gap'; startTime: string; durationMin: number }> = []

  for (let i = 0; i < sorted.length; i++) {
    // Gap before first appt or between appts
    if (i > 0) {
      const prev = sorted[i - 1]
      const gapStart = new Date(prev.ends_at)
      const gapEnd = new Date(sorted[i].starts_at)
      const gapMin = differenceInMinutes(gapEnd, gapStart)
      if (gapMin >= 10) {
        result.push({ type: 'gap', startTime: format(gapStart, 'HH:mm'), durationMin: gapMin })
      }
    }
    result.push({ type: 'appt', appt: sorted[i] })
  }

  return result
}

// ── Vista principal ──────────────────────────────────────────────────────────
export function AgendaView({ worker, todayAppointments, weekStats }: Props) {
  const supabase = createClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState(todayAppointments)
  const [loadingDate, setLoadingDate] = useState(false)
  const [dayRevenue, setDayRevenue] = useState(
    todayAppointments.filter(a => a.status === 'completed').reduce((s, a) => s + (a.services?.price ?? 0), 0)
  )
  const [pendingBlock, setPendingBlock] = useState<{ time: string; maxMin: number } | null>(null)

  const selectDate = async (date: Date) => {
    setSelectedDate(date)
    setLoadingDate(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const prevStr = format(addDays(date, -1), 'yyyy-MM-dd')
      const nextStr = format(addDays(date, 1), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('appointments')
        .select(`id, client_name, client_phone, starts_at, ends_at, status, notes, recommended_style, services(name, price, duration_minutes)`)
        .eq('worker_id', worker.id)
        .gte('starts_at', `${prevStr}T00:00:00`)
        .lte('starts_at', `${nextStr}T23:59:59`)
        .not('status', 'eq', 'cancelled')
        .order('starts_at', { ascending: true })

      const filtered = ((data as any[]) ?? []).filter(
        a => new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) === dateStr
      )
      setAppointments(filtered)
      setDayRevenue(filtered.filter(a => a.status === 'completed').reduce((s, a) => s + (a.services?.price ?? 0), 0))
    } finally {
      setLoadingDate(false)
    }
  }

  const handleMark = (id: string) => {
    setAppointments(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, status: 'completed' } : a)
      setDayRevenue(updated.filter(a => a.status === 'completed').reduce((s, a) => s + (a.services?.price ?? 0), 0))
      return updated
    })
  }

  const handleBlock = (time: string, maxMin: number) => {
    setPendingBlock({ time, maxMin })
  }

  const confirmBlock = async (durationMin: number, reason: string) => {
    if (!pendingBlock) return
    const [h, m] = pendingBlock.time.split(':').map(Number)
    const starts = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      h, m, 0
    )
    const ends = new Date(starts.getTime() + durationMin * 60 * 1000)

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        worker_id: worker.id,
        barbershop_id: worker.barbershop_id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: 'blocked',
        client_name: reason.trim() || 'Bloqueado',
        client_phone: null,
        service_id: null,
      })
      .select()
      .single()

    if (error) {
      console.error('confirmBlock error:', error)
      toast.error('Error al bloquear el horario')
      return
    }

    setAppointments(prev => [...prev, data])
    setPendingBlock(null)
    toast.success('Horario bloqueado')
  }

  const handleUnblock = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id))
  }

  const calendarUrl = worker.calendar_token
    ? `webcal://${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '')}/api/calendar/${worker.calendar_token}`
    : null

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  // Próxima cita (hoy, en el futuro, no completada)
  const now = new Date()
  const nextAppt = isToday
    ? appointments.find(a => new Date(a.starts_at) > now && a.status !== 'completed' && a.status !== 'cancelled')
    : null

  const pendingCount = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending_payment').length
  const timeline = buildTimeline(appointments.filter(a => a.status !== 'cancelled'))

  return (
    <>
    {pendingBlock && (
      <BlockModal
        time={pendingBlock.time}
        maxMin={pendingBlock.maxMin}
        onConfirm={confirmBlock}
        onClose={() => setPendingBlock(null)}
      />
    )}
    <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[rgb(var(--fg))]">Hola, {worker.name.split(' ')[0]}</h1>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mt-0.5">
            {isToday
              ? `${appointments.length} citas hoy · ${formatPrice(dayRevenue)} ganados`
              : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>
        {calendarUrl && (
          <a href={calendarUrl} className="flex items-center gap-1 text-xs border border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] px-2.5 py-1.5 rounded-full hover:border-brand-red hover:text-brand-red transition-all">
            <LinkIcon size={10} /> iCal
          </a>
        )}
      </div>

      {/* Stat chips */}
      <div className="flex gap-2 mb-4">
        <div className="card flex-1 p-2.5 text-center">
          <p className="text-lg font-bold text-[rgb(var(--fg))]">{weekStats.total}</p>
          <p className="text-[10px] text-[rgb(var(--fg-secondary))]">Citas semana</p>
        </div>
        <div className="card flex-1 p-2.5 text-center">
          <p className="text-lg font-bold text-green-500">{weekStats.completed}</p>
          <p className="text-[10px] text-[rgb(var(--fg-secondary))]">Completadas</p>
        </div>
        <div className="card flex-1 p-2.5 text-center">
          <p className="text-lg font-bold text-[rgb(var(--fg))]">{formatPrice(weekStats.revenue)}</p>
          <p className="text-[10px] text-[rgb(var(--fg-secondary))]">Semana</p>
        </div>
      </div>

      {/* Week strip */}
      <WeekStrip selectedDate={selectedDate} onSelect={selectDate} />

      {/* Siguiente cliente — card destacado */}
      {nextAppt && (
        <div className="card p-4 mb-4 border-brand-red">
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-red mb-2">
            Siguiente · en {Math.round(differenceInMinutes(parseISO(nextAppt.starts_at), now))} min
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-[rgb(var(--fg))]">
                {format(parseISO(nextAppt.starts_at), 'HH:mm')} — {nextAppt.client_name}
              </p>
              <p className="text-xs text-[rgb(var(--fg-secondary))]">
                {nextAppt.services?.name}
                {nextAppt.notes && ` · "${nextAppt.notes}"`}
              </p>
            </div>
            {nextAppt.client_phone && (
              <a
                href={`https://wa.me/${nextAppt.client_phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                className="p-2 rounded-xl bg-brand-red/10 text-brand-red hover:bg-brand-red/20 transition-all shrink-0"
              >
                <Phone size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {loadingDate ? (
        <div className="text-center py-10">
          <Loader2 className="animate-spin text-brand-red mx-auto" size={22} />
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-8 text-center">
          <Calendar size={26} className="text-[rgb(var(--fg-secondary))]/30 mx-auto mb-2" />
          <p className="text-sm text-[rgb(var(--fg-secondary))]">Sin citas para este día</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {timeline.map((item, idx) =>
            item.type === 'gap' ? (
              <FreeSlot
                key={`gap-${idx}`}
                startTime={item.startTime}
                durationMin={item.durationMin}
                onBlock={handleBlock}
              />
            ) : (
              <AppointmentItem
                key={item.appt.id}
                appt={item.appt}
                isNext={nextAppt?.id === item.appt.id}
                onMark={handleMark}
                onUnblock={handleUnblock}
              />
            )
          )}
        </div>
      )}

      {/* iCal info */}
      {calendarUrl && (
        <div className="card p-4 mt-5">
          <h3 className="text-sm font-semibold text-[rgb(var(--fg))] mb-1 flex items-center gap-2">
            <Calendar size={13} /> Sincronizar calendario
          </h3>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mb-3">
            Agrega tu agenda a Apple Calendar o Google Calendar.
          </p>
          <a href={calendarUrl} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 justify-center">
            <LinkIcon size={11} /> Suscribir a Apple Calendar
          </a>
          <code className="text-[10px] bg-[rgb(var(--bg-secondary))] block px-2 py-1 rounded mt-2 break-all text-[rgb(var(--fg-secondary))]">
            {calendarUrl.replace('webcal://', 'https://')}
          </code>
        </div>
      )}
    </main>
    </>
  )
}
