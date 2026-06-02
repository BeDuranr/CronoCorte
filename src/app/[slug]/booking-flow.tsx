'use client'

import { useState } from 'react'
import { format, addDays, parseISO, startOfDay, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculateAvailableSlots, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, Clock, Check, Loader2,
  Instagram, MapPin, Scissors, Phone, Users, User
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

// Una persona dentro de la reserva: sus servicios y el horario elegido.
interface Person {
  services: Service[]
  time: string | null // "HH:mm"
}

// ─── Step 0: ¿Cuántas personas? ───────────────────────────────────────────────
function StepPeopleCount({
  count,
  onSelect,
}: {
  count: number
  onSelect: (n: number) => void
}) {
  const options = [1, 2, 3, 4]
  return (
    <div>
      <p className="text-sm text-[rgb(var(--fg-secondary))] mb-4">
        ¿Para cuántas personas quieres reservar? Puedes agendar para ti y tus acompañantes en una sola reserva.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map(n => (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={`card p-5 flex flex-col items-center gap-2 transition-all hover:border-brand-red/40 ${
              count === n ? 'border-brand-red bg-brand-red/5' : ''
            }`}
          >
            {n === 1 ? (
              <User size={24} className="text-brand-red" />
            ) : (
              <Users size={24} className="text-brand-red" />
            )}
            <span className="font-bold text-[rgb(var(--fg))]">
              {n} {n === 1 ? 'persona' : 'personas'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step: selección de servicios (para una persona dada) ─────────────────────
function StepService({
  services,
  selected,
  onToggle,
  personLabel,
}: {
  services: Service[]
  selected: Service[]
  onToggle: (s: Service) => void
  personLabel?: string
}) {
  const total = selected.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = selected.reduce((sum, s) => sum + s.duration_minutes, 0)

  return (
    <div className="flex flex-col gap-3">
      {personLabel && (
        <p className="text-sm font-semibold text-brand-red flex items-center gap-1.5">
          <User size={14} /> {personLabel}
        </p>
      )}
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
              <div>
                <p className="font-semibold text-[rgb(var(--fg))]">{svc.name}</p>
                <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5 flex items-center gap-1">
                  <Clock size={12} /> {svc.duration_minutes} min
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[rgb(var(--fg))]">{formatPrice(svc.price)}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'bg-brand-red border-brand-red' : 'border-[rgb(var(--fg-secondary))]/30'
                }`}>
                  {isSelected && <Check size={11} className="text-white" />}
                </div>
              </div>
            </div>
          </button>
        )
      })}

      {selected.length > 0 && (
        <div className="card p-3 border-brand-red/20 bg-brand-red/5 flex items-center justify-between text-sm">
          <span className="text-[rgb(var(--fg-secondary))]">
            {selected.length} servicio{selected.length > 1 ? 's' : ''} · {totalDuration} min
          </span>
          <span className="font-bold text-brand-red">{formatPrice(total)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Step: selección de barbero ───────────────────────────────────────────────
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

// ─── Step: fecha y selección de horarios (1 o varios) ─────────────────────────
// Para reservas grupales, el cliente elige tantos horarios como personas haya.
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
  const supabase = createClient()
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loadedDay, setLoadedDay] = useState<string | null>(null)

  const today = startOfDay(new Date())
  const visibleDays = Array.from({ length: 14 }, (_, i) => addDays(today, i + weekOffset * 14))

  const availableDaysOfWeek = new Set(availability.map(a => a.day_of_week))

  const loadSlots = async (date: Date) => {
    onDateChange(date)
    setLoadingSlots(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dow = date.getDay()

      const avail = availability.find(a => a.day_of_week === dow)
      if (!avail) {
        setSlots([])
        setLoadedDay(dateStr)
        return
      }

      // Rango ampliado +/-1 dia: las citas se guardan en UTC, y una cita en hora
      // Chile (UTC-4/-3) puede caer en el dia UTC anterior o siguiente. La
      // comparacion precisa la hace calculateAvailableSlots con parseISO.
      const prevStr = format(addDays(date, -1), 'yyyy-MM-dd')
      const nextStr = format(addDays(date, 1), 'yyyy-MM-dd')

      const { data: existing } = await supabase
        .from('appointments')
        .select('starts_at, ends_at')
        .eq('worker_id', workerId)
        .gte('starts_at', `${prevStr}T00:00:00`)
        .lte('starts_at', `${nextStr}T23:59:59`)
        .not('status', 'eq', 'cancelled')

      const available = calculateAvailableSlots({
        availability: avail,
        existingAppointments: (existing ?? []).map(a => ({
          starts_at: a.starts_at,
          ends_at: a.ends_at,
        })),
        serviceDuration,
        date: dateStr,
      })

      setSlots(available)
      setLoadedDay(dateStr)
    } finally {
      setLoadingSlots(false)
    }
  }

  const isMulti = peopleCount > 1
  const remaining = peopleCount - selectedTimes.length

  return (
    <div>
      {/* Date strip */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
            className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[rgb(var(--fg-secondary))] font-medium">
            Elige una fecha
          </span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] transition-all"
          >
            <ChevronRight size={16} />
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
                  isSelected
                    ? 'bg-brand-red text-white'
                    : isPast || !isAvail
                    ? 'opacity-25 cursor-not-allowed'
                    : 'hover:bg-[rgb(var(--bg-secondary))]'
                }`}
              >
                <span className="text-[9px] font-medium uppercase text-inherit">
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

      {/* Time slots */}
      {loadingSlots ? (
        <div className="text-center py-6">
          <Loader2 size={20} className="animate-spin text-brand-red mx-auto" />
        </div>
      ) : slots.length > 0 ? (
        <>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mb-2">
            Horarios disponibles — {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {slots.map(slot => {
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
        </>
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

// ─── Step final: confirmar y crear la reserva ─────────────────────────────────
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

  // Total de todas las personas
  const grandTotal = people.reduce(
    (sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
    0
  )

  // Construir un timestamp con offset de Chile a partir de la fecha + hora "HH:mm"
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
      // Emparejar cada persona con un horario (orden ascendente por hora)
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

      // Notificación WhatsApp (no bloquea el flujo si Twilio falla)
      fetch('/api/whatsapp/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: data.id }),
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
        <h3 className="font-semibold text-sm text-[rgb(var(--fg-secondary))] uppercase tracking-wide">
          Resumen de tu reserva
        </h3>

        {people.map((person, idx) => {
          const personTotal = person.services.reduce((s, svc) => s + svc.price, 0)
          return (
            <div key={idx} className="flex flex-col gap-1 pb-2 border-b border-[rgb(var(--fg-secondary))]/10 last:border-0 last:pb-0">
              {isMulti && (
                <p className="text-xs font-semibold text-brand-red flex items-center gap-1">
                  <User size={11} /> {idx === 0 ? 'Tú' : `Acompañante ${idx}`} · {sortedTimes[idx]}
                </p>
              )}
              {person.services.map(svc => (
                <div key={svc.id} className="flex items-center gap-2">
                  <Scissors size={13} className="text-brand-red shrink-0" />
                  <span className="text-sm text-[rgb(var(--fg))]">{svc.name}</span>
                  <span className="ml-auto text-sm font-medium text-[rgb(var(--fg))]">{formatPrice(svc.price)}</span>
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

        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-[8px] font-bold">
            {worker.name.charAt(0)}
          </div>
          <span className="text-sm text-[rgb(var(--fg))]">{worker.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-brand-red" />
          <span className="text-sm text-[rgb(var(--fg))]">
            {format(date, "EEE d 'de' MMMM", { locale: es })}
            {!isMulti && ` · ${sortedTimes[0]}`}
          </span>
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
            <span className="input w-16 text-center text-[rgb(var(--fg-secondary))] flex items-center justify-center">
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

// ─── Pantalla de éxito ────────────────────────────────────────────────────────
function BookingSuccess({ people, worker, date, times, barbershop, cancelToken }: any) {
  const dateLabel = format(date, "EEEE d 'de' MMMM", { locale: es })
  const grandTotal = people.reduce(
    (sum: number, p: Person) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
    0
  )
  const sortedTimes = [...times].sort()
  const isMulti = people.length > 1

  const paymentDeadline = new Date(Date.now() + 30 * 60 * 1000)
  const deadlineStr = paymentDeadline.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Detalle de servicios para el mensaje de WhatsApp
  const detailLines = people.map((p: Person, idx: number) => {
    const names = p.services.map(s => s.name).join(' + ')
    const who = isMulti ? (idx === 0 ? 'Tú' : `Acompañante ${idx}`) : ''
    return `- ${who ? who + ': ' : ''}${names} (${sortedTimes[idx]})`
  })

  const waMessage = [
    `Hola! Reservé en ${barbershop.name}.`,
    ``,
    `*Detalle:*`,
    ...detailLines,
    `- Barbero: ${worker.name}`,
    `- Fecha: ${dateLabel}`,
    `- Total: ${formatPrice(grandTotal)}`,
    ``,
    barbershop.transfer_info
      ? `*Datos de transferencia:*\n${barbershop.transfer_info}\n`
      : ``,
    `Adjunto el comprobante de transferencia para confirmar mi hora.`,
  ].join('\n')

  const phoneClean = barbershop.phone?.replace(/[^0-9]/g, '') ?? ''
  const waUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(waMessage)}`

  return (
    <div className="py-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-[rgb(var(--fg))] mb-2">¡Hora agendada!</h2>
        <p className="text-[rgb(var(--fg-secondary))] text-sm">
          Para confirmar {isMulti ? 'las horas' : 'tu hora'}, envía el comprobante de transferencia por WhatsApp.
        </p>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 mb-4 flex items-start gap-3">
        <span className="text-yellow-500 text-lg leading-none mt-0.5">⏳</span>
        <div>
          <p className="text-sm font-semibold text-yellow-500">Tienes 30 minutos para pagar</p>
          <p className="text-xs text-[rgb(var(--fg-secondary))] mt-0.5">
            Si no recibimos el comprobante antes de las{' '}
            <strong className="text-[rgb(var(--fg))]">{deadlineStr}</strong>,{' '}
            {isMulti ? 'las horas serán liberadas' : 'tu hora será liberada'} automáticamente.
          </p>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex flex-col gap-2 text-sm">
          {people.map((p: Person, idx: number) => {
            const personTotal = p.services.reduce((s, svc) => s + svc.price, 0)
            return (
              <div key={idx} className="flex justify-between">
                <span className="text-[rgb(var(--fg-secondary))]">
                  {isMulti ? `${idx === 0 ? 'Tú' : `Acompañante ${idx}`} · ${sortedTimes[idx]}` : p.services.map(s => s.name).join(' + ')}
                </span>
                <span className="font-medium text-[rgb(var(--fg))]">{formatPrice(personTotal)}</span>
              </div>
            )
          })}
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Barbero</span>
            <span className="font-medium text-[rgb(var(--fg))]">{worker.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Fecha</span>
            <span className="font-medium text-[rgb(var(--fg))]">{format(date, "d MMM", { locale: es })}</span>
          </div>
          <div className="flex justify-between border-t border-[rgb(var(--fg-secondary))]/10 pt-2 mt-1">
            <span className="text-[rgb(var(--fg-secondary))]">Total a transferir</span>
            <span className="font-bold text-brand-red text-base">{formatPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      {barbershop.transfer_info && (
        <div className="card p-4 mb-4 border-brand-red/20">
          <p className="text-xs font-semibold text-[rgb(var(--fg-secondary))] uppercase tracking-wide mb-2">
            💳 Datos de transferencia
          </p>
          <pre className="text-sm text-[rgb(var(--fg))] whitespace-pre-wrap font-sans leading-relaxed">
            {barbershop.transfer_info}
          </pre>
        </div>
      )}

      {phoneClean ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm
                     transition-colors mb-3"
        >
          <Phone size={16} />
          Enviar comprobante por WhatsApp
        </a>
      ) : (
        <p className="text-sm text-center text-[rgb(var(--fg-secondary))] mb-3">
          Envía tu comprobante directamente a la barbería para confirmar.
        </p>
      )}

      <button
        onClick={() => window.location.reload()}
        className="btn-secondary w-full text-sm"
      >
        Reservar otro turno
      </button>

      {cancelToken && (
        <p className="text-center text-xs text-[rgb(var(--fg-secondary))] mt-4">
          ¿Necesitas cancelar?{' '}
          <a href={`/cancelar/${cancelToken}`} className="text-brand-red hover:underline">
            Cancelar mi reserva
          </a>
        </p>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function BookingFlow({ barbershop, services, workers, availability }: Props) {
  // Si hay un solo barbero, se asigna automáticamente y se omite el paso de selección.
  const singleWorker = workers.length === 1

  // step: 0=personas, 1=servicios, 2=barbero, 3=horarios, 4=confirmar
  const [step, setStep] = useState(0)
  const [peopleCount, setPeopleCount] = useState(1)
  const [people, setPeople] = useState<Person[]>([{ services: [], time: null }])
  const [activePerson, setActivePerson] = useState(0) // índice de la persona cuyos servicios se editan
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(
    singleWorker ? workers[0] : null
  )
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [successData, setSuccessData] = useState<{ id: string; cancelToken: string } | null>(null)

  // Duración máxima entre personas (para calcular slots; como todo cabe en 60min, será 60)
  const maxDuration = Math.max(
    60,
    ...people.map(p => p.services.reduce((s, svc) => s + svc.duration_minutes, 0))
  )

  const setCount = (n: number) => {
    setPeopleCount(n)
    setPeople(Array.from({ length: n }, (_, i) => people[i] ?? { services: [], time: null }))
    setActivePerson(0)
    setSelectedTimes([])
    setStep(1)
  }

  const toggleServiceForActive = (svc: Service) => {
    setPeople(prev =>
      prev.map((p, i) => {
        if (i !== activePerson) return p
        const has = p.services.some(s => s.id === svc.id)
        return {
          ...p,
          services: has ? p.services.filter(s => s.id !== svc.id) : [...p.services, svc],
        }
      })
    )
  }

  const toggleTime = (t: string) => {
    setSelectedTimes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  // ¿La persona activa tiene al menos un servicio?
  const activeHasServices = people[activePerson]?.services.length > 0
  const allPeopleHaveServices = people.every(p => p.services.length > 0)
  const timesComplete = selectedTimes.length === peopleCount

  const STEPS = singleWorker
    ? ['Personas', 'Servicios', 'Horario', 'Confirmar']
    : ['Personas', 'Servicios', 'Barbero', 'Horario', 'Confirmar']

  // Mapeo entre el índice visual del tab y el índice real de step interno.
  // Con barbero único, el tab de "Horario" (visual 2) corresponde al step interno 3.
  const stepToVisual = (s: number) => (singleWorker && s >= 3 ? s - 1 : s)
  const visualToStep = (v: number) => (singleWorker && v >= 2 ? v + 1 : v)

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      {/* Header */}
      <div className="border-b bg-[rgb(var(--bg))]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
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
                <span className="absolute top-[8px] left-[-1px] w-[20px] h-[2.5px] bg-brand-red rounded-full -rotate-[15deg]" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xs font-black text-[rgb(var(--fg))] tracking-tight">
                  {barbershop.name.split(' ')[0].toLowerCase()}
                </span>
                <span className="text-[8px] font-light text-brand-red tracking-[3px]">
                  {barbershop.name.split(' ').slice(1).join(' ').toLowerCase() || 'barbería'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {successData ? (
          <BookingSuccess
            people={people}
            worker={selectedWorker}
            date={selectedDate}
            times={selectedTimes}
            barbershop={barbershop}
            cancelToken={successData.cancelToken}
          />
        ) : (
          <>
            {/* Step tabs */}
            <div className="flex gap-1 mb-6">
              {STEPS.map((label, i) => {
                const visualStep = stepToVisual(step)
                return (
                  <button
                    key={i}
                    onClick={() => i < visualStep && setStep(visualToStep(i))}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-all ${
                      i === visualStep
                        ? 'bg-brand-red text-white'
                        : i < visualStep
                        ? 'bg-brand-red/10 text-brand-red cursor-pointer'
                        : 'bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))] cursor-not-allowed opacity-50'
                    }`}
                  >
                    {i < visualStep ? '✓' : i + 1} {label}
                  </button>
                )
              })}
            </div>

            {/* Step 0: personas */}
            {step === 0 && (
              <StepPeopleCount count={peopleCount} onSelect={setCount} />
            )}

            {/* Step 1: servicios (por persona si es grupal) */}
            {step === 1 && (
              <>
                {peopleCount > 1 && (
                  <div className="flex gap-2 mb-4">
                    {people.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePerson(i)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                          activePerson === i
                            ? 'bg-brand-red text-white border-brand-red'
                            : p.services.length > 0
                            ? 'border-brand-red/30 text-brand-red'
                            : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                        }`}
                      >
                        {p.services.length > 0 && '✓ '}
                        {i === 0 ? 'Tú' : `Acomp. ${i}`}
                      </button>
                    ))}
                  </div>
                )}

                <StepService
                  services={services}
                  selected={people[activePerson]?.services ?? []}
                  onToggle={toggleServiceForActive}
                  personLabel={peopleCount > 1 ? (activePerson === 0 ? 'Servicios para ti' : `Servicios acompañante ${activePerson}`) : undefined}
                />

                {/* Navegación entre personas / continuar */}
                {peopleCount > 1 && activePerson < peopleCount - 1 ? (
                  activeHasServices && (
                    <button
                      onClick={() => setActivePerson(activePerson + 1)}
                      className="btn-primary w-full mt-4"
                    >
                      Siguiente persona <ChevronRight size={16} className="inline ml-1" />
                    </button>
                  )
                ) : (
                  allPeopleHaveServices && (
                    <button onClick={() => setStep(singleWorker ? 3 : 2)} className="btn-primary w-full mt-4">
                      Continuar <ChevronRight size={16} className="inline ml-1" />
                    </button>
                  )
                )}
              </>
            )}

            {/* Step 2: barbero */}
            {step === 2 && (
              <StepWorker
                workers={workers}
                selected={selectedWorker}
                onSelect={wk => {
                  setSelectedWorker(wk)
                  setSelectedTimes([])
                  setStep(3)
                }}
              />
            )}

            {/* Step 3: horarios */}
            {step === 3 && selectedWorker && (
              <>
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
                {timesComplete && (
                  <button onClick={() => setStep(4)} className="btn-primary w-full mt-4">
                    Continuar <ChevronRight size={16} className="inline ml-1" />
                  </button>
                )}
              </>
            )}

            {/* Step 4: confirmar */}
            {step === 4 && selectedWorker && timesComplete && (
              <StepConfirm
                barbershop={barbershop}
                people={people}
                worker={selectedWorker}
                date={selectedDate}
                times={selectedTimes}
                onSuccess={(id, cancelToken) => setSuccessData({ id, cancelToken })}
              />
            )}

            {/* Botón volver */}
            {step > 0 && step < 4 && (
              <button
                onClick={() => setStep(s => (singleWorker && s === 3 ? 1 : s - 1))}
                className="flex items-center gap-1 text-sm text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors mt-4"
              >
                <ChevronLeft size={14} /> Volver
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
