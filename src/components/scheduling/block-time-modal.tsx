'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { calculateFreeStretches, enumerateGrid } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BanIcon, Loader2, X } from 'lucide-react'

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
  workerId: string
  availability: AvailabilityRow[]
  initialDate?: string // 'yyyy-MM-dd', por defecto hoy
  onCreated: (block: BlockedSlot) => void
  onClose: () => void
}

const GRANULARITY_MIN = 30

// Construye un timestamp con el offset local de pared, mismo patrón que
// buildTimestamps en citas-view.tsx / booking-flow.tsx.
function buildTimestamp(dateStr: string, time: string) {
  const local = new Date(`${dateStr}T${time}:00`)
  const offsetMinutes = local.getTimezoneOffset()
  const offsetSign = offsetMinutes <= 0 ? '+' : '-'
  const offsetAbs = Math.abs(offsetMinutes)
  const tz = `${offsetSign}${String(Math.floor(offsetAbs / 60)).padStart(2, '0')}:${String(offsetAbs % 60).padStart(2, '0')}`
  return `${dateStr}T${time}:00${tz}`
}

export function BlockTimeModal({ workerId, availability, initialDate, onCreated, onClose }: Props) {
  const supabase = createClient()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const [date, setDate] = useState(initialDate ?? todayStr)
  const [occupied, setOccupied] = useState<{ starts_at: string; ends_at: string }[]>([])
  const [loadingOccupied, setLoadingOccupied] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openDows = useMemo(() => new Set(availability.map(a => a.day_of_week)), [availability])

  // Próximas fechas que atiende la barbería (mismo criterio que el modal de cita manual)
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

  useEffect(() => {
    if (availableDates.length === 0) return
    if (!availableDates.some(d => d.value === date)) setDate(availableDates[0].value)
  }, [availableDates]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar ocupado (citas + bloqueos existentes) cada vez que cambia la fecha
  useEffect(() => {
    let cancelled = false
    setStartTime('')
    setEndTime('')
    if (!date) return

    const load = async () => {
      setLoadingOccupied(true)
      try {
        const res = await fetch(`/api/availability?worker_id=${encodeURIComponent(workerId)}&date=${date}`)
        const json = res.ok ? await res.json() : { occupied: [] }
        if (!cancelled) setOccupied(json.occupied ?? [])
      } finally {
        if (!cancelled) setLoadingOccupied(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [workerId, date])

  const dayAvailability = useMemo(() => {
    const [yy, mm, dd] = date.split('-').map(Number)
    const dow = new Date(yy, mm - 1, dd).getDay()
    return availability.find(a => a.day_of_week === dow) ?? null
  }, [date, availability])

  const stretches = useMemo(() => {
    if (!dayAvailability) return []
    return calculateFreeStretches({ availability: dayAvailability, occupied, date, granularityMinutes: GRANULARITY_MIN })
  }, [dayAvailability, occupied, date])

  // Cada tramo libre aporta sus horas de inicio posibles, salvo la última (necesita
  // espacio para al menos un paso de grilla después).
  const startOptions = useMemo(
    () => stretches.flatMap(s => enumerateGrid(s.start, s.end, GRANULARITY_MIN).slice(0, -1)),
    [stretches]
  )

  const activeStretch = stretches.find(s => startTime >= s.start && startTime < s.end)
  const endOptions = activeStretch
    ? enumerateGrid(activeStretch.start, activeStretch.end, GRANULARITY_MIN).filter(t => t > startTime)
    : []

  const handleSubmit = async () => {
    if (!startTime || !endTime) return
    setSubmitting(true)
    try {
      const starts_at = buildTimestamp(date, startTime)
      const ends_at = buildTimestamp(date, endTime)
      const { data, error } = await supabase
        .from('blocked_slots')
        .insert({ worker_id: workerId, starts_at, ends_at, reason: reason.trim() || null })
        .select()
        .single()

      if (error) {
        console.error('BlockTimeModal insert error:', error)
        toast.error(error.code === '23P01' ? 'Ese horario se solapa con otro bloqueo' : 'Error al bloquear el horario')
        return
      }

      onCreated(data)
      toast.success('Horario bloqueado')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BanIcon size={14} className="text-[rgb(var(--fg-secondary))]" />
            <b className="text-sm text-[rgb(var(--fg))]">Bloquear horario</b>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]">
            <X size={14} />
          </button>
        </div>

        {/* Fecha */}
        <div className="mb-4">
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

        {/* Desde */}
        <div className="mb-4">
          <p className="label mb-1">Desde</p>
          {loadingOccupied ? (
            <div className="flex items-center gap-2 text-xs text-[rgb(var(--fg-secondary))] py-2">
              <Loader2 size={13} className="animate-spin" /> Buscando horas libres…
            </div>
          ) : startOptions.length === 0 ? (
            <p className="text-xs text-[rgb(var(--fg-secondary))] py-2">No hay horas libres ese día.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {startOptions.map(t => (
                <button
                  key={t}
                  onClick={() => { setStartTime(t); setEndTime('') }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    startTime === t
                      ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                      : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hasta */}
        {startTime && (
          <div className="mb-4">
            <p className="label mb-1">Hasta</p>
            <div className="flex flex-wrap gap-2">
              {endOptions.map(t => (
                <button
                  key={t}
                  onClick={() => setEndTime(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    endTime === t
                      ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                      : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Motivo */}
        <div className="mb-5">
          <p className="label mb-1">Motivo (opcional)</p>
          <input
            className="input w-full"
            placeholder="Ej: Trámite, descanso, vacaciones..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !startTime || !endTime}
            className="btn-primary text-sm py-1.5 px-4 bg-brand-red hover:bg-[#bd2f39] flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <><BanIcon size={13} /> Bloquear</>}
          </button>
        </div>
      </div>
    </div>
  )
}
