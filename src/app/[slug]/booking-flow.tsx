'use client'

import { useState, useEffect, useRef } from 'react'
import { format, addDays, startOfDay, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculateAvailableSlots, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Clock, Check, Loader2,
  Instagram, MapPin, Scissors, Phone, Plus, Copy, Calendar,
  RefreshCw
} from 'lucide-react'

interface Barbershop {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  phone: string | null
  instagram: string | null
  logo_url: string | null
  transfer_info: string | null
}

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
}

interface Worker {
  id: string
  name: string
  specialty: string | null
  avatar_url: string | null
}

interface Props {
  barbershop: Barbershop
  services: Service[]
  workers: Worker[]
  availability: { day_of_week: number; start_time: string; end_time: string }[]
}

interface Person {
  services: Service[]
  time: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupSlots(slots: string[]) {
  const morning: string[] = [], afternoon: string[] = [], night: string[] = []
  slots.forEach(s => {
    const h = parseInt(s.split(':')[0])
    if (h < 13) morning.push(s)
    else if (h < 19) afternoon.push(s)
    else night.push(s)
  })
  return [
    { label: 'Mañana', slots: morning },
    { label: 'Tarde', slots: afternoon },
    { label: 'Noche', slots: night },
  ].filter(g => g.slots.length > 0)
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({
  labels,
  currentVisual,
  onClickVisual,
}: {
  labels: string[]
  currentVisual: number
  onClickVisual: (v: number) => void
}) {
  return (
    <div className="border-b border-[rgb(var(--border))]">
    <div className="max-w-lg md:max-w-2xl mx-auto flex items-start px-5 py-3">
      {labels.map((label, i) => (
        <div key={i} className="flex items-start flex-1 last:flex-none">
          <button
            onClick={() => i < currentVisual && onClickVisual(i)}
            className="flex flex-col items-center shrink-0"
            style={{ cursor: i < currentVisual ? 'pointer' : 'default' }}
          >
            <div
              className={`w-[30px] h-[30px] rounded-full border-[1.5px] flex items-center justify-center text-[12px] font-bold transition-all ${
                i === currentVisual
                  ? 'border-brand-red bg-brand-red text-white'
                  : i < currentVisual
                  ? 'border-brand-red text-brand-red'
                  : 'border-[rgb(var(--fg-secondary))]/30 text-[rgb(var(--fg-secondary))]'
              }`}
            >
              {i < currentVisual ? <Check size={12} /> : i + 1}
            </div>
            <span
              className={`text-[9px] font-medium mt-1 whitespace-nowrap ${
                i === currentVisual
                  ? 'text-[rgb(var(--fg))] font-semibold'
                  : 'text-[rgb(var(--fg-secondary))]'
              }`}
            >
              {label}
            </span>
          </button>
          {i < labels.length - 1 && (
            <div
              className={`h-px flex-1 mx-1 mt-[15px] transition-all ${
                i < currentVisual
                  ? 'bg-brand-red'
                  : 'bg-[rgb(var(--fg-secondary))]/20'
              }`}
            />
          )}
        </div>
      ))}
    </div>
    </div>
  )
}

// ── Step: servicios ───────────────────────────────────────────────────────────
function StepService({
  services,
  people,
  activePerson,
  onToggle,
  onSetActivePerson,
  onAddPerson,
  onRemovePerson,
}: {
  services: Service[]
  people: Person[]
  activePerson: number
  onToggle: (svc: Service) => void
  onSetActivePerson: (i: number) => void
  onAddPerson: () => void
  onRemovePerson: (i: number) => void
}) {
  const selected = people[activePerson]?.services ?? []
  const isMulti = people.length > 1

  return (
    <div className="flex flex-col gap-3">
      {/* Person tabs (solo cuando hay acompañantes) */}
      {isMulti && (
        <div className="flex gap-1.5 mb-1 flex-wrap">
          {people.map((p, i) => (
            <button
              key={i}
              onClick={() => onSetActivePerson(i)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                activePerson === i
                  ? 'bg-brand-red text-white border-brand-red'
                  : p.services.length > 0
                  ? 'border-brand-red/30 text-brand-red'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
              }`}
            >
              {p.services.length > 0 ? '✓ ' : ''}{i === 0 ? 'Tú' : `Acomp. ${i}`}
              {i > 0 && (
                <span
                  onClick={e => { e.stopPropagation(); onRemovePerson(i) }}
                  className={`text-sm leading-none opacity-60 hover:opacity-100 transition-opacity ${activePerson === i ? 'text-white' : ''}`}
                  title="Quitar"
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Servicio cards */}
      {services.map(svc => {
        const isSelected = selected.some(s => s.id === svc.id)
        return (
          <button
            key={svc.id}
            onClick={() => onToggle(svc)}
            className={`card p-4 text-left transition-all hover:border-brand-red/40 ${
              isSelected ? 'border-brand-red bg-brand-red/5' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 mr-3">
                <p className="font-semibold text-[rgb(var(--fg))] truncate">{svc.name}</p>
                <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5 flex items-center gap-1">
                  <Clock size={12} /> {svc.duration_minutes} min
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-[rgb(var(--fg))]">{formatPrice(svc.price)}</span>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-brand-red border-brand-red'
                      : 'border-[rgb(var(--fg-secondary))]/30'
                  }`}
                >
                  {isSelected && <Check size={11} className="text-white" />}
                </div>
              </div>
            </div>
          </button>
        )
      })}

      {/* Chip: + Acompañante */}
      <button
        onClick={onAddPerson}
        className="self-start flex items-center gap-1.5 text-xs font-medium border border-[rgb(var(--fg-secondary))]/20
                   text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] hover:border-[rgb(var(--fg-secondary))]/40
                   px-3 py-1.5 rounded-full transition-all mt-1"
      >
        <Plus size={11} /> Acompañante
      </button>
    </div>
  )
}

// ── Step: barbero ─────────────────────────────────────────────────────────────
function StepWorker({
  workers,
  selected,
  onSelect,
}: {
  workers: Worker[]
  selected: Worker | null
  onSelect: (w: Worker) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {workers.map(worker => (
        <button
          key={worker.id}
          onClick={() => onSelect(worker)}
          className={`card p-4 text-left flex items-center gap-3 transition-all hover:border-brand-red/40 ${
            selected?.id === worker.id ? 'border-brand-red bg-brand-red/5' : ''
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-sm font-bold shrink-0">
            {worker.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[rgb(var(--fg))]">{worker.name}</p>
            {worker.specialty && (
              <p className="text-sm text-[rgb(var(--fg-secondary))]">{worker.specialty}</p>
            )}
          </div>
          {selected?.id === worker.id && (
            <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Step: fecha y horario ─────────────────────────────────────────────────────
function StepDateTime({
  selectedDate,
  selectedTimes,
  onDateChange,
  onToggleTime,
  availability,
  workerId,
  serviceDuration,
  peopleCount,
}: {
  selectedDate: Date
  selectedTimes: string[]
  onDateChange: (d: Date) => void
  onToggleTime: (t: string) => void
  availability: Props['availability']
  workerId: string
  serviceDuration: number
  peopleCount: number
}) {
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loadedDay, setLoadedDay] = useState<string | null>(null)
  const slotsCache = useRef<Map<string, string[]>>(new Map())

  const today = startOfDay(new Date())
  const visibleDays = Array.from({ length: 14 }, (_, i) => addDays(today, i + weekOffset * 14))
  const availableDaysOfWeek = new Set(availability.map(a => a.day_of_week))

  const loadSlots = async (date: Date) => {
    onDateChange(date)
    const dateStr = format(date, 'yyyy-MM-dd')
    const cacheKey = `${workerId}__${dateStr}`

    // Hit de caché: sin fetch ni spinner
    if (slotsCache.current.has(cacheKey)) {
      setSlots(slotsCache.current.get(cacheKey)!)
      setLoadedDay(dateStr)
      return
    }

    setLoadingSlots(true)
    try {
      const dow = date.getDay()
      const avail = availability.find(a => a.day_of_week === dow)
      if (!avail) {
        slotsCache.current.set(cacheKey, [])
        setSlots([]); setLoadedDay(dateStr); return
      }

      let existing: { starts_at: string; ends_at: string }[] = []
      try {
        const res = await fetch(`/api/availability?worker_id=${encodeURIComponent(workerId)}&date=${dateStr}`)
        if (res.ok) { const json = await res.json(); existing = json.occupied ?? [] }
      } catch { existing = [] }

      const available = calculateAvailableSlots({
        availability: avail,
        existingAppointments: existing.map(a => ({ starts_at: a.starts_at, ends_at: a.ends_at })),
        serviceDuration,
        date: dateStr,
      })
      slotsCache.current.set(cacheKey, available)
      setSlots(available)
      setLoadedDay(dateStr)
    } finally {
      setLoadingSlots(false)
    }
  }

  const isMulti = peopleCount > 1
  const remaining = peopleCount - selectedTimes.length
  const groups = groupSlots(slots)

  return (
    <div>
      {/* Day selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
            className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[rgb(var(--fg-secondary))] font-medium">Elige una fecha</span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {visibleDays.map((day, i) => {
            const isAvail = availableDaysOfWeek.has(day.getDay())
            const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
            const isPast = isBefore(day, today)
            return (
              <button
                key={i}
                onClick={() => !isPast && isAvail && loadSlots(day)}
                disabled={isPast || !isAvail}
                className={`flex flex-col items-center py-2 px-0.5 rounded-lg text-center transition-all ${
                  isSelected ? 'bg-brand-red text-white' :
                  isPast || !isAvail ? 'opacity-25 cursor-not-allowed' :
                  'hover:bg-[rgb(var(--bg-secondary))]'
                }`}
              >
                <span className="text-[9px] font-medium uppercase">
                  {format(day, 'EEE', { locale: es }).slice(0, 2)}
                </span>
                <span className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-[rgb(var(--fg))]'}`}>
                  {format(day, 'd')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Aviso multi-persona */}
      {isMulti && (
        <div className="rounded-lg border border-brand-red/20 bg-brand-red/5 px-3 py-2 mb-3 text-xs text-[rgb(var(--fg-secondary))]">
          {remaining > 0
            ? `Selecciona ${remaining} horario${remaining > 1 ? 's' : ''} más (uno por persona, ${peopleCount} en total).`
            : `Listo: ${peopleCount} horarios seleccionados.`}
        </div>
      )}

      {/* Slots agrupados por franja */}
      {loadingSlots ? (
        <div className="text-center py-6">
          <Loader2 size={20} className="animate-spin text-brand-red mx-auto" />
        </div>
      ) : groups.length > 0 ? (
        <div className="flex flex-col gap-5">
          {groups.map(({ label, slots: gs }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-[rgb(var(--fg-secondary))] uppercase tracking-wider mb-2">
                {label}
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {gs.map(slot => {
                  const isPicked = selectedTimes.includes(slot)
                  const atCapacity = !isPicked && selectedTimes.length >= peopleCount
                  return (
                    <button
                      key={slot}
                      onClick={() => onToggleTime(slot)}
                      disabled={atCapacity}
                      className={`py-2 px-1 rounded-lg text-sm font-medium border transition-all ${
                        isPicked
                          ? 'bg-brand-red text-white border-brand-red'
                          : atCapacity
                          ? 'border-[rgb(var(--fg-secondary))]/10 text-[rgb(var(--fg-secondary))]/30 cursor-not-allowed'
                          : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg))] hover:border-brand-red hover:text-brand-red'
                      }`}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : loadedDay ? (
        <div className="text-center py-6 text-[rgb(var(--fg-secondary))] text-sm">
          No hay horarios disponibles ese día. Prueba con otro.
        </div>
      ) : (
        <div className="text-center py-6 text-[rgb(var(--fg-secondary))] text-sm">
          Selecciona un día disponible para ver horarios
        </div>
      )}
    </div>
  )
}

// ── Step final: confirmar y crear la reserva ──────────────────────────────────
function StepConfirm({
  barbershop,
  people,
  worker,
  date,
  times,
  onSuccess,
}: {
  barbershop: Barbershop
  people: Person[]
  worker: Worker
  date: Date
  times: string[]
  onSuccess: (appointmentId: string, cancelToken: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })

  const grandTotal = people.reduce(
    (sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
    0
  )

  const buildTimestamps = (time: string, durationMin: number) => {
    const dateStr = format(date, 'yyyy-MM-dd')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error('Nombre y teléfono son requeridos')
    }
    setLoading(true)
    const cancelToken = crypto.randomUUID().replace(/-/g, '')
    try {
      const sortedTimes = [...times].sort()
      const blocks = people.map((person, idx) => {
        const duration = person.services.reduce((s, svc) => s + svc.duration_minutes, 0) || 60
        const { startsAt, endsAt } = buildTimestamps(sortedTimes[idx], duration)
        const primary = person.services[0]
        const extra = person.services.slice(1).map(s => s.name).join(', ')
        const noteParts = [
          extra ? `Servicios adicionales: ${extra}` : '',
          idx === 0 && form.notes.trim() ? form.notes.trim() : '',
        ].filter(Boolean)
        return {
          service_id: primary.id,
          starts_at: startsAt,
          ends_at: endsAt,
          notes: noteParts.length ? noteParts.join('\n') : null,
        }
      })

      const res = await fetch('/api/appointments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbershop_id: barbershop.id,
          worker_id: worker.id,
          client_name: form.name.trim(),
          client_phone: form.phone.trim().startsWith('+') ? form.phone.trim() : `+56${form.phone.trim()}`,
          cancel_token: cancelToken,
          blocks,
          total_amount: grandTotal,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al reservar')

      fetch('/api/whatsapp/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: data.id, cancel_token: cancelToken }),
      }).catch(() => {})

      onSuccess(data.id, cancelToken)
    } catch (err: any) {
      toast.error(err.message || 'Error al reservar')
    } finally {
      setLoading(false)
    }
  }

  const sortedTimes = [...times].sort()
  const isMulti = people.length > 1

  return (
    <div>
      {/* Resumen */}
      <div className="card p-4 mb-5 flex flex-col gap-3">
        <h3 className="font-semibold text-xs text-[rgb(var(--fg-secondary))] uppercase tracking-wide">
          Resumen de tu reserva
        </h3>

        {people.map((person, idx) => {
          const personTotal = person.services.reduce((s, svc) => s + svc.price, 0)
          return (
            <div key={idx} className="flex flex-col gap-1 pb-2 border-b border-[rgb(var(--fg-secondary))]/10 last:border-0 last:pb-0">
              {isMulti && (
                <p className="text-xs font-semibold text-brand-red">
                  {idx === 0 ? 'Tú' : `Acompañante ${idx}`} · {sortedTimes[idx]}
                </p>
              )}
              {person.services.map(svc => (
                <div key={svc.id} className="flex items-center gap-2">
                  <Scissors size={13} className="text-brand-red shrink-0" />
                  <span className="text-sm text-[rgb(var(--fg))]">{svc.name}</span>
                  <span className="ml-auto text-sm font-medium">{formatPrice(svc.price)}</span>
                </div>
              ))}
              {isMulti && (
                <span className="text-xs text-[rgb(var(--fg-secondary))] text-right">
                  Subtotal: {formatPrice(personTotal)}
                </span>
              )}
            </div>
          )
        })}

        <div className="flex items-center gap-2 text-sm text-[rgb(var(--fg))]">
          <div className="w-5 h-5 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-[9px] font-bold">
            {worker.name.charAt(0)}
          </div>
          {worker.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--fg))]">
          <Clock size={14} className="text-brand-red" />
          {format(date, "EEE d 'de' MMMM", { locale: es })}
          {!isMulti && ` · ${sortedTimes[0]}`}
        </div>

        <div className="flex justify-between border-t border-[rgb(var(--fg-secondary))]/10 pt-2">
          <span className="text-sm text-[rgb(var(--fg-secondary))]">
            Total {isMulti ? `(${people.length} personas)` : ''}
          </span>
          <span className="font-bold text-brand-red">{formatPrice(grandTotal)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Tu nombre</label>
          <input
            className="input"
            placeholder="Ej: Carlos Ramírez"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label">WhatsApp</label>
          <div className="flex gap-2">
            <span className="input w-16 text-center text-[rgb(var(--fg-secondary))] flex items-center justify-center shrink-0">
              +56
            </span>
            <input
              type="tel"
              className="input flex-1"
              placeholder="912345678"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
            />
          </div>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">
            Recibirás confirmación y recordatorio por WhatsApp.
          </p>
        </div>
        <div>
          <label className="label">Notas adicionales (opcional)</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Ej: Tengo el pelo rizado, quiero degradado al 2..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar reserva'}
        </button>
      </form>
    </div>
  )
}

// ── Pantalla de éxito ─────────────────────────────────────────────────────────
function BookingSuccess({ people, worker, date, times, barbershop, cancelToken }: any) {
  const [secs, setSecs] = useState(30 * 60)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const progress = (secs / (30 * 60)) * 100

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const dateLabel = format(date, "EEEE d 'de' MMMM", { locale: es })
  const grandTotal = people.reduce(
    (sum: number, p: Person) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
    0
  )
  const sortedTimes = [...times].sort()
  const isMulti = people.length > 1

  // Parsear transfer_info en líneas para copiar individualmente
  const transferLines = (barbershop.transfer_info ?? '').split('\n').filter((l: string) => l.trim())

  // .ics download
  const downloadIcs = () => {
    const dateStr = format(date, 'yyyyMMdd')
    const timeParts = (sortedTimes[0] ?? '12:00').split(':')
    const hh = timeParts[0].padStart(2, '0')
    const mm2 = (timeParts[1] ?? '00').padStart(2, '0')
    const dur = people[0]?.services.reduce((s: number, svc: Service) => s + svc.duration_minutes, 0) ?? 60
    const endMins = parseInt(hh) * 60 + parseInt(mm2) + dur
    const endHH = String(Math.floor(endMins / 60) % 24).padStart(2, '0')
    const endMM2 = String(endMins % 60).padStart(2, '0')
    const summary = `${people[0]?.services[0]?.name ?? 'Reserva'} - ${barbershop.name}`
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CronoCorte//ES',
      'BEGIN:VEVENT',
      `DTSTART:${dateStr}T${hh}${mm2}00`,
      `DTEND:${dateStr}T${endHH}${endMM2}00`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:Barbero: ${worker.name}\\nFecha: ${dateLabel}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'reserva.ics'; a.click()
    URL.revokeObjectURL(url)
  }

  const detailLines = people.map((p: Person, idx: number) => {
    const names = p.services.map(s => s.name).join(' + ')
    const who = isMulti ? (idx === 0 ? 'Tú' : `Acompañante ${idx}`) : ''
    return `- ${who ? who + ': ' : ''}${names} (${sortedTimes[idx]})`
  })

  const waMessage = [
    `Hola! Reservé en ${barbershop.name}.`, '',
    '*Detalle:*', ...detailLines,
    `- Barbero: ${worker.name}`,
    `- Fecha: ${dateLabel}`,
    `- Total: ${formatPrice(grandTotal)}`, '',
    barbershop.transfer_info ? `*Datos de transferencia:*\n${barbershop.transfer_info}\n` : '',
    'Adjunto el comprobante de transferencia para confirmar mi hora.',
  ].join('\n')

  const phoneClean = barbershop.phone?.replace(/[^0-9]/g, '') ?? ''
  const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(waMessage)}`

  return (
    <div className="py-8">
      {/* Ícono éxito */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
          <Check size={24} className="text-green-500" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold text-[rgb(var(--fg))]">¡Hora agendada!</h2>
        <p className="text-[rgb(var(--fg-secondary))] text-sm mt-1">
          Envía el comprobante para confirmar
        </p>
      </div>

      {/* Contador regresivo con barra */}
      <div className="text-center mb-5">
        <p className="text-3xl font-bold tabular-nums text-[rgb(var(--fg))]">{mm}:{ss}</p>
        <div className="h-[3px] bg-[rgb(var(--bg-secondary))] rounded-full overflow-hidden mt-2 mb-1.5">
          <div
            className="h-full bg-brand-red rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-[rgb(var(--fg-secondary))]">
          Tienes 30 minutos para enviar el comprobante, de lo contrario la hora será liberada
        </p>
      </div>

      {/* Resumen reserva */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col gap-2 text-sm">
          {people.map((p: Person, idx: number) => {
            const personTotal = p.services.reduce((s, svc) => s + svc.price, 0)
            return (
              <div key={idx} className="flex justify-between">
                <span className="text-[rgb(var(--fg-secondary))]">
                  {isMulti
                    ? `${idx === 0 ? 'Tú' : `Acomp. ${idx}`} · ${sortedTimes[idx]}`
                    : p.services.map(s => s.name).join(' + ')}
                </span>
                <span className="font-medium">{formatPrice(personTotal)}</span>
              </div>
            )
          })}
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Barbero</span>
            <span>{worker.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Fecha</span>
            <span>{format(date, "d MMM", { locale: es })}</span>
          </div>
          <div className="flex justify-between border-t border-[rgb(var(--fg-secondary))]/10 pt-2 mt-1">
            <span className="text-[rgb(var(--fg-secondary))]">Total a transferir</span>
            <span className="font-bold text-brand-red text-base">{formatPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Datos de transferencia con copia por campo y copia total */}
      {transferLines.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[rgb(var(--fg-secondary))] uppercase tracking-wide">
              Datos de transferencia
            </p>
            <button
              onClick={() => copyText(barbershop.transfer_info ?? '', 'all')}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] hover:border-brand-red hover:text-brand-red transition-all"
            >
              {copied === 'all'
                ? <><Check size={11} className="text-green-500" /> Copiado</>
                : <><Copy size={11} /> Copiar datos</>}
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[rgb(var(--fg-secondary))]/10">
            {transferLines.map((line: string, i: number) => {
              const colonIdx = line.indexOf(':')
              const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line.trim()
              const value = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : ''
              const key = `tf-${i}`
              return (
                <div key={i} className="flex items-center justify-between py-2 text-sm gap-3">
                  <span className="flex-1 truncate">
                    <span className="text-[rgb(var(--fg-secondary))]">{label}</span>
                    {value && (
                      <span className="ml-1 font-medium text-[rgb(var(--fg))]">{value}</span>
                    )}
                  </span>
                  {value && (
                    <button
                      onClick={() => copyText(value, key)}
                      className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all shrink-0"
                      title="Copiar"
                    >
                      {copied === key
                        ? <Check size={12} className="text-green-500" />
                        : <Copy size={12} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-col gap-2 mb-4">
        {phoneClean ? (
          <>
            <p className="text-xs text-center text-[rgb(var(--fg-secondary))]">
              Recibirás un mensaje automático con los datos. Si no llega, puedes enviarlo manualmente:
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                         bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm transition-colors"
            >
              <Phone size={15} />
              Enviar comprobante por WhatsApp
            </a>
          </>
        ) : (
          <p className="text-xs text-center text-[rgb(var(--fg-secondary))]">
            Envía tu comprobante directamente a la barbería para confirmar.
          </p>
        )}

        <button
          onClick={downloadIcs}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Calendar size={14} />
          Agregar a mi calendario
        </button>
      </div>

      {/* Links secundarios */}
      <p className="text-center text-xs text-[rgb(var(--fg-secondary))]">
        ¿Imprevisto?{' '}
        {cancelToken && (
          <>
            <a
              href={`/cancelar/${cancelToken}`}
              className="text-brand-red hover:underline"
            >
              Reprogramar o cancelar
            </a>
          </>
        )}
      </p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function BookingFlow({ barbershop, services, workers, availability }: Props) {
  const singleWorker = workers.length === 1

  // Steps: 0=servicios, 1=barbero (si múltiples), 2=horario, 3=confirmar
  const [step, setStep] = useState(0)
  const [people, setPeople] = useState<Person[]>([{ services: [], time: null }])
  const [activePerson, setActivePerson] = useState(0)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(
    singleWorker ? workers[0] : null
  )
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [successData, setSuccessData] = useState<{ id: string; cancelToken: string } | null>(null)

  const peopleCount = people.length

  const maxDuration = Math.max(
    60,
    ...people.map(p => p.services.reduce((s, svc) => s + svc.duration_minutes, 0))
  )

  const addPerson = () => {
    setPeople(prev => [...prev, { services: [], time: null }])
    setActivePerson(people.length)
  }

  const removePerson = (i: number) => {
    setPeople(prev => prev.filter((_, idx) => idx !== i))
    setActivePerson(prev => (prev >= i ? Math.max(0, prev - 1) : prev))
  }

  const toggleService = (svc: Service) => {
    setPeople(prev =>
      prev.map((p, i) => {
        if (i !== activePerson) return p
        const has = p.services.some(s => s.id === svc.id)
        return { ...p, services: has ? p.services.filter(s => s.id !== svc.id) : [...p.services, svc] }
      })
    )
  }

  const toggleTime = (t: string) => {
    setSelectedTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const allPeopleHaveServices = people.every(p => p.services.length > 0)
  const timesComplete = selectedTimes.length === peopleCount

  const totalPrice = people.reduce((sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0), 0)
  const totalDuration = people.reduce((sum, p) => sum + p.services.reduce((s, svc) => s + svc.duration_minutes, 0), 0)
  const totalServices = people.reduce((sum, p) => sum + p.services.length, 0)

  const LABELS = singleWorker
    ? ['Servicios', 'Horario', 'Datos']
    : ['Servicios', 'Barbero', 'Horario', 'Datos']

  const stepToVisual = (s: number): number => {
    if (singleWorker) {
      if (s === 0) return 0
      if (s === 2) return 1
      return 2
    }
    return s
  }

  const visualToStep = (v: number): number => {
    if (singleWorker) {
      if (v === 0) return 0
      if (v === 1) return 2
      return 3
    }
    return v
  }

  const goNext = () => {
    if (step === 0) setStep(singleWorker ? 2 : 1)
    else if (step === 1) { setSelectedTimes([]); setStep(2) }
    else if (step === 2) setStep(3)
  }

  const goBack = () => {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(singleWorker ? 0 : 1)
    else if (step === 1) setStep(0)
  }

  // Resumen persistente para pasos 1+
  const summaryParts = [
    people[0]?.services.length > 0
      ? people[0].services.map(s => s.name).join(' + ')
      : null,
    step > 1 && selectedWorker ? selectedWorker.name : null,
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">

      {/* Header barbería */}
      <div className="border-b bg-[rgb(var(--bg))]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-[rgb(var(--fg))]">{barbershop.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                {barbershop.address && (
                  <span className="text-xs text-[rgb(var(--fg-secondary))] flex items-center gap-1">
                    <MapPin size={10} /> {barbershop.address}
                  </span>
                )}
                {barbershop.instagram && (
                  <a
                    href={`https://instagram.com/${barbershop.instagram}`}
                    target="_blank"
                    className="text-xs text-[rgb(var(--fg-secondary))] hover:text-brand-red flex items-center gap-1 transition-colors"
                  >
                    <Instagram size={10} /> @{barbershop.instagram}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <span className="text-2xl font-black text-[rgb(var(--fg))] leading-none">
                  {barbershop.name.charAt(0).toUpperCase()}
                </span>
                <span className="absolute top-[8px] left-[-1px] w-[20px] h-[2.5px] bg-[#e63946] rounded-full -rotate-[15deg]" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-black text-[rgb(var(--fg))] tracking-tight">
                  {barbershop.name.split(' ')[0].toLowerCase()}
                </span>
                <span className="text-[8px] font-light text-[#e63946] tracking-[3px]">
                  {barbershop.name.split(' ').slice(1).join(' ').toLowerCase() || 'barbería'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {successData ? (
        <div className="max-w-lg md:max-w-2xl mx-auto px-4">
          <BookingSuccess
            people={people}
            worker={selectedWorker}
            date={selectedDate}
            times={selectedTimes}
            barbershop={barbershop}
            cancelToken={successData.cancelToken}
          />
        </div>
      ) : (
        <>
          {/* Stepper */}
          <Stepper
            labels={LABELS}
            currentVisual={stepToVisual(step)}
            onClickVisual={v => {
              if (v < stepToVisual(step)) setStep(visualToStep(v))
            }}
          />

          <div className="max-w-lg md:max-w-2xl mx-auto px-4 py-5 pb-28">
            {/* Resumen persistente (pasos 1+) */}
            {step > 0 && summaryParts.length > 0 && (
              <div className="flex items-center justify-between text-xs mb-4 pb-3 border-b border-[rgb(var(--fg-secondary))]/10">
                <span className="text-[rgb(var(--fg-secondary))] truncate mr-3">
                  {summaryParts.join(' · ')}
                </span>
                <button onClick={() => setStep(0)} className="text-brand-red font-semibold shrink-0">
                  Editar
                </button>
              </div>
            )}

            {/* Step 0: servicios */}
            {step === 0 && (
              <StepService
                services={services}
                people={people}
                activePerson={activePerson}
                onToggle={toggleService}
                onSetActivePerson={setActivePerson}
                onAddPerson={addPerson}
                onRemovePerson={removePerson}
              />
            )}

            {/* Step 1: barbero */}
            {step === 1 && (
              <StepWorker
                workers={workers}
                selected={selectedWorker}
                onSelect={wk => {
                  setSelectedWorker(wk)
                  setSelectedTimes([])
                  goNext()
                }}
              />
            )}

            {/* Step 2: horario */}
            {step === 2 && selectedWorker && (
              <StepDateTime
                selectedDate={selectedDate}
                selectedTimes={selectedTimes}
                onDateChange={setSelectedDate}
                onToggleTime={toggleTime}
                availability={availability}
                workerId={selectedWorker.id}
                serviceDuration={maxDuration}
                peopleCount={peopleCount}
              />
            )}

            {/* Step 3: confirmar */}
            {step === 3 && selectedWorker && timesComplete && (
              <StepConfirm
                barbershop={barbershop}
                people={people}
                worker={selectedWorker}
                date={selectedDate}
                times={selectedTimes}
                onSuccess={(id, cancelToken) => setSuccessData({ id, cancelToken })}
              />
            )}

            {/* Volver (steps 1 y 2; step 1 auto-avanza al seleccionar barbero) */}
            {(step === 2 || step === 3) && (
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors mt-5"
              >
                <ChevronLeft size={14} /> Volver
              </button>
            )}
          </div>

          {/* Barra inferior fija — servicios */}
          {step === 0 && totalServices > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-[rgb(var(--bg))] border-t border-[rgb(var(--fg-secondary))]/20">
              <div className="max-w-lg md:max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-[rgb(var(--fg))]">{formatPrice(totalPrice)}</p>
                  <p className="text-xs text-[rgb(var(--fg-secondary))]">
                    {totalServices} servicio{totalServices > 1 ? 's' : ''} · {totalDuration} min
                  </p>
                </div>
                <button
                  onClick={goNext}
                  disabled={!allPeopleHaveServices}
                  className="btn-primary shrink-0 disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Barra inferior fija — horario (cuando seleccionó todos los horarios) */}
          {step === 2 && timesComplete && (
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-[rgb(var(--bg))] border-t border-[rgb(var(--fg-secondary))]/20">
              <div className="max-w-lg md:max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-[rgb(var(--fg))]">
                    {format(selectedDate, "d 'de' MMM", { locale: es })} · {selectedTimes.slice().sort().join(', ')}
                  </p>
                  <p className="text-xs text-[rgb(var(--fg-secondary))]">{selectedWorker?.name}</p>
                </div>
                <button onClick={goNext} className="btn-primary shrink-0">Continuar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
