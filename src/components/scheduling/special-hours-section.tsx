'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DatePicker } from '@/components/scheduling/date-picker'
import { TimePicker } from '@/components/scheduling/time-picker'
import {
  enumerateDates, groupOverrideRanges, isWithinOpeningHours, toChileWall, type DateOverride,
} from '@/lib/utils'
import toast from 'react-hot-toast'
import { AlertTriangle, CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react'

interface OverrideRow extends DateOverride {
  id: string
}

interface ConflictingAppointment {
  id: string
  client_name: string
  starts_at: string
}

// Tope de días por rango, para evitar cargar meses enteros por error.
const MAX_RANGE_DAYS = 62

// ── Horarios especiales por fecha (feriados, Navidad, vacaciones…) ─────────
// Reemplazan al horario semanal solo en las fechas indicadas. Se puede elegir
// un día o un rango; en la BD se guarda una fila por día. Al guardar se revisa
// si ya hay citas agendadas que queden fuera del nuevo horario: no se cancelan
// solas, solo se avisa para que el admin decida qué hacer.
export function SpecialHoursSection({ barbershopId }: { barbershopId: string }) {
  const supabase = createClient()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const [isRange, setIsRange] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isClosed, setIsClosed] = useState(true)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('14:00')
  const [label, setLabel] = useState('')

  const [conflicts, setConflicts] = useState<{ start: string; end: string; appointments: ConflictingAppointment[] } | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('schedule_overrides')
      .select('id, date, is_closed, start_time, end_time, label')
      .eq('barbershop_id', barbershopId)
      .gte('date', todayStr)
      .order('date')
    setOverrides((data as OverrideRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [barbershopId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Citas no canceladas de las fechas que quedan fuera de su horario especial.
  const findConflicts = async (rows: DateOverride[]): Promise<ConflictingAppointment[]> => {
    const first = rows[0].date
    const last = rows[rows.length - 1].date
    // Rango ampliado +/-1 día para cubrir el desfase UTC/Chile; luego se
    // filtra por fecha de pared en Chile.
    const [fy, fm, fd] = first.split('-').map(Number)
    const [ly, lm, ld] = last.split('-').map(Number)
    const from = new Date(Date.UTC(fy, fm - 1, fd - 1)).toISOString()
    const to = new Date(Date.UTC(ly, lm - 1, ld + 2)).toISOString()
    const { data } = await supabase
      .from('appointments')
      .select('id, client_name, starts_at, ends_at')
      .eq('barbershop_id', barbershopId)
      .not('status', 'eq', 'cancelled')
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at')
    const dates = new Set(rows.map(r => r.date))
    return (data ?? []).filter(
      a =>
        dates.has(toChileWall(a.starts_at).date) &&
        !isWithinOpeningHours(a.starts_at, a.ends_at, [], rows)
    )
  }

  const resetForm = () => {
    setStartDate('')
    setEndDate('')
    setIsClosed(true)
    setStartTime('10:00')
    setEndTime('14:00')
    setLabel('')
  }

  const changeMode = (range: boolean) => {
    setIsRange(range)
    setStartDate('')
    setEndDate('')
  }

  const handleSave = async () => {
    if (!startDate || (isRange && !endDate)) {
      return toast.error(isRange ? 'Elige el primer y el último día' : 'Elige una fecha')
    }
    const end = isRange ? endDate : startDate
    if (startDate < todayStr) return toast.error('La fecha no puede ser pasada')
    if (!isClosed && endTime <= startTime) return toast.error('La hora de cierre debe ser posterior a la de apertura')

    const dates = enumerateDates(startDate, end)
    if (dates.length > MAX_RANGE_DAYS) return toast.error(`El rango no puede superar ${MAX_RANGE_DAYS} días`)

    const rows: DateOverride[] = dates.map(date => ({
      date,
      is_closed: isClosed,
      start_time: isClosed ? null : startTime,
      end_time: isClosed ? null : endTime,
      label: label.trim() || null,
    }))

    setSaving(true)
    try {
      // Una excepción por fecha: si ya existía para alguno de esos días, se reemplaza.
      const { error } = await supabase
        .from('schedule_overrides')
        .upsert(rows.map(r => ({ barbershop_id: barbershopId, ...r })), { onConflict: 'barbershop_id,date' })
      if (error) throw error

      const conflicting = await findConflicts(rows)
      setConflicts(conflicting.length > 0 ? { start: startDate, end, appointments: conflicting } : null)

      toast.success(dates.length === 1 ? 'Horario especial guardado' : `Horario especial guardado para ${dates.length} días`)
      resetForm()
      load()
    } catch {
      toast.error('Error al guardar el horario especial')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (key: string, ids: string[]) => {
    setDeletingKey(key)
    try {
      const { error } = await supabase.from('schedule_overrides').delete().in('id', ids)
      if (error) throw error
      setOverrides(prev => prev.filter(o => !ids.includes(o.id)))
      toast.success('Horario especial eliminado')
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeletingKey(null)
    }
  }

  const formatDay = (d: string) => format(parseISO(d), "EEEE d 'de' MMMM yyyy", { locale: es })
  const formatRange = (start: string, end: string) =>
    start === end
      ? formatDay(start)
      : `${format(parseISO(start), "EEE d 'de' MMM", { locale: es })} → ${format(parseISO(end), "EEE d 'de' MMM yyyy", { locale: es })}`

  const groups = groupOverrideRanges(overrides)

  return (
    <div className="flex flex-col gap-3 mt-6">
      <div>
        <p className="font-semibold text-[rgb(var(--fg))] flex items-center gap-2">
          <CalendarClock size={16} /> Horarios especiales
        </p>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
          Para feriados, vacaciones o fechas puntuales (Navidad, Año Nuevo…). Solo cambian esos días; el horario semanal no se toca.
        </p>
      </div>

      {conflicts && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          <p className="font-medium text-[rgb(var(--fg))] flex items-start gap-2">
            <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
            <span>
              {conflicts.appointments.length === 1
                ? 'Hay 1 cita agendada fuera de este horario'
                : `Hay ${conflicts.appointments.length} citas agendadas fuera de este horario`}
              {` (${formatRange(conflicts.start, conflicts.end)})`}
            </span>
          </p>
          <ul className="mt-2 ml-6 list-disc text-xs text-[rgb(var(--fg-secondary))]">
            {conflicts.appointments.map(a => {
              const wall = toChileWall(a.starts_at)
              return (
                <li key={a.id}>
                  {conflicts.start !== conflicts.end && `${format(parseISO(wall.date), "EEE d 'de' MMM", { locale: es })} · `}
                  {wall.time} · {a.client_name}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mt-2">
            No se cancelaron. Revísalas en{' '}
            <Link href="/dashboard/citas" className="text-brand-red underline">Citas</Link>{' '}
            y decide qué hacer con cada una.
          </p>
          <button onClick={() => setConflicts(null)} className="text-xs text-[rgb(var(--fg-secondary))] underline mt-2">
            Entendido
          </button>
        </div>
      )}

      {/* Formulario */}
      <div className="card p-3 flex flex-col gap-3">
        <div className="flex gap-2">
          {[
            { range: false, text: 'Un día' },
            { range: true, text: 'Varios días' },
          ].map(opt => (
            <button
              key={opt.text}
              onClick={() => changeMode(opt.range)}
              className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                isRange === opt.range
                  ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <label className="label">{isRange ? 'Fechas' : 'Fecha'}</label>
            <DatePicker
              range={isRange}
              value={startDate}
              endValue={endDate}
              onChange={(start, end) => { setStartDate(start); setEndDate(end) }}
              min={todayStr}
              markedDates={overrides.map(o => o.date)}
            />
          </div>
          <div className="flex-1">
            <label className="label">Nombre (opcional)</label>
            <input
              className="input text-sm py-1.5 px-3"
              value={label}
              maxLength={40}
              onChange={e => setLabel(e.target.value)}
              placeholder={isRange ? 'Ej: Vacaciones' : 'Ej: Navidad'}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { closed: true, text: 'Cerrado' },
            { closed: false, text: 'Horario distinto' },
          ].map(opt => (
            <button
              key={opt.text}
              onClick={() => setIsClosed(opt.closed)}
              className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                isClosed === opt.closed
                  ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>

        {!isClosed && (
          <div className="flex items-center gap-2">
            <TimePicker value={startTime} onChange={setStartTime} className="flex-1" />
            <span className="text-[10px] text-[rgb(var(--fg-secondary))] shrink-0">a</span>
            <TimePicker value={endTime} onChange={setEndTime} after={startTime} align="right" className="flex-1" />
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 justify-center">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Agregar horario especial
        </button>
        <p className="text-xs text-[rgb(var(--fg-secondary))]">
          {isRange
            ? 'Se aplica el mismo horario a todos los días del rango. Los días que ya tenían horario especial se reemplazan.'
            : 'Si la fecha ya tenía un horario especial, se reemplaza.'}
        </p>
      </div>

      {/* Próximos horarios especiales (días seguidos iguales se muestran como rango) */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-[rgb(var(--fg-secondary))]" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-xs text-[rgb(var(--fg-secondary))] text-center py-2">
          No tienes horarios especiales próximos.
        </p>
      ) : (
        groups.map(g => {
          const o = g.items[0]
          const key = `${g.start}_${g.end}`
          return (
            <div key={key} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[rgb(var(--fg))] first-letter:uppercase">{formatRange(g.start, g.end)}</p>
                <p className="text-xs text-[rgb(var(--fg-secondary))]">
                  {o.label ? `${o.label} · ` : ''}
                  {o.is_closed ? 'Cerrado' : `${o.start_time?.slice(0, 5)} a ${o.end_time?.slice(0, 5)}`}
                  {g.items.length > 1 ? ` · ${g.items.length} días` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(key, g.items.map(i => i.id))}
                disabled={deletingKey === key}
                className="p-1.5 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))] hover:text-brand-red transition-all"
                aria-label="Eliminar horario especial"
              >
                {deletingKey === key ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
