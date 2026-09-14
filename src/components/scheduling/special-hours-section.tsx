'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isWithinOpeningHours, toChileWall, type DateOverride } from '@/lib/utils'
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

// ── Horarios especiales por fecha (feriados, Navidad…) ─────────────────────
// Reemplazan al horario semanal solo en la fecha indicada. Al guardar uno se
// revisa si ya hay citas agendadas ese día que queden fuera del nuevo horario:
// no se cancelan solas, solo se avisa para que el admin decida qué hacer.
export function SpecialHoursSection({ barbershopId }: { barbershopId: string }) {
  const supabase = createClient()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [date, setDate] = useState('')
  const [isClosed, setIsClosed] = useState(true)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('14:00')
  const [label, setLabel] = useState('')

  const [conflicts, setConflicts] = useState<{ date: string; appointments: ConflictingAppointment[] } | null>(null)

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

  // Citas no canceladas del día que quedan fuera del horario especial.
  const findConflicts = async (override: DateOverride): Promise<ConflictingAppointment[]> => {
    // Rango ampliado +/-1 día para cubrir el desfase UTC/Chile; luego se
    // filtra por fecha de pared en Chile.
    const [yy, mm, dd] = override.date.split('-').map(Number)
    const from = new Date(Date.UTC(yy, mm - 1, dd - 1)).toISOString()
    const to = new Date(Date.UTC(yy, mm - 1, dd + 2)).toISOString()
    const { data } = await supabase
      .from('appointments')
      .select('id, client_name, starts_at, ends_at')
      .eq('barbershop_id', barbershopId)
      .not('status', 'eq', 'cancelled')
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at')
    return (data ?? []).filter(
      a =>
        toChileWall(a.starts_at).date === override.date &&
        !isWithinOpeningHours(a.starts_at, a.ends_at, [], [override])
    )
  }

  const resetForm = () => {
    setDate('')
    setIsClosed(true)
    setStartTime('10:00')
    setEndTime('14:00')
    setLabel('')
  }

  const handleSave = async () => {
    if (!date) return toast.error('Elige una fecha')
    if (date < todayStr) return toast.error('La fecha no puede ser pasada')
    if (!isClosed && endTime <= startTime) return toast.error('La hora de cierre debe ser posterior a la de apertura')

    const override: DateOverride = {
      date,
      is_closed: isClosed,
      start_time: isClosed ? null : startTime,
      end_time: isClosed ? null : endTime,
      label: label.trim() || null,
    }

    setSaving(true)
    try {
      // Una excepción por fecha: si ya existía para ese día, se reemplaza.
      const { error } = await supabase
        .from('schedule_overrides')
        .upsert({ barbershop_id: barbershopId, ...override }, { onConflict: 'barbershop_id,date' })
      if (error) throw error

      const conflicting = await findConflicts(override)
      setConflicts(conflicting.length > 0 ? { date, appointments: conflicting } : null)

      toast.success('Horario especial guardado')
      resetForm()
      load()
    } catch {
      toast.error('Error al guardar el horario especial')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from('schedule_overrides').delete().eq('id', id)
      if (error) throw error
      setOverrides(prev => prev.filter(o => o.id !== id))
      toast.success('Horario especial eliminado')
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDay = (d: string) => format(parseISO(d), "EEEE d 'de' MMMM yyyy", { locale: es })

  return (
    <div className="flex flex-col gap-3 mt-6">
      <div>
        <p className="font-semibold text-[rgb(var(--fg))] flex items-center gap-2">
          <CalendarClock size={16} /> Horarios especiales
        </p>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
          Para feriados o fechas puntuales (Navidad, Año Nuevo…). Solo cambian ese día; el horario semanal no se toca.
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
              {` (${formatDay(conflicts.date)})`}
            </span>
          </p>
          <ul className="mt-2 ml-6 list-disc text-xs text-[rgb(var(--fg-secondary))]">
            {conflicts.appointments.map(a => (
              <li key={a.id}>{toChileWall(a.starts_at).time} · {a.client_name}</li>
            ))}
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
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label className="label">Fecha</label>
            <input
              type="date"
              className="input text-sm py-1 px-2"
              min={todayStr}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="label">Nombre (opcional)</label>
            <input
              className="input text-sm py-1 px-2"
              value={label}
              maxLength={40}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ej: Navidad"
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
            <input
              type="time"
              className="input text-sm py-1 px-2 flex-1"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            />
            <span className="text-[10px] text-[rgb(var(--fg-secondary))] shrink-0">a</span>
            <input
              type="time"
              className="input text-sm py-1 px-2 flex-1"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            />
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 justify-center">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Agregar horario especial
        </button>
        <p className="text-xs text-[rgb(var(--fg-secondary))]">
          Si la fecha ya tenía un horario especial, se reemplaza.
        </p>
      </div>

      {/* Próximos horarios especiales */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-[rgb(var(--fg-secondary))]" />
        </div>
      ) : overrides.length === 0 ? (
        <p className="text-xs text-[rgb(var(--fg-secondary))] text-center py-2">
          No tienes horarios especiales próximos.
        </p>
      ) : (
        overrides.map(o => (
          <div key={o.id} className="card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[rgb(var(--fg))] first-letter:uppercase">{formatDay(o.date)}</p>
              <p className="text-xs text-[rgb(var(--fg-secondary))]">
                {o.label ? `${o.label} · ` : ''}
                {o.is_closed ? 'Cerrado' : `${o.start_time?.slice(0, 5)} a ${o.end_time?.slice(0, 5)}`}
              </p>
            </div>
            <button
              onClick={() => handleDelete(o.id)}
              disabled={deletingId === o.id}
              className="p-1.5 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))] hover:text-brand-red transition-all"
              aria-label="Eliminar horario especial"
            >
              {deletingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        ))
      )}
    </div>
  )
}
