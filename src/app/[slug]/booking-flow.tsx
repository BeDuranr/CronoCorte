'use client'

import { useState } from 'react'
import { format, addDays, parseISO, startOfDay, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculateAvailableSlots, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, Clock, Check, Loader2,
  Instagram, MapPin, Scissors, Phone
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

// ─── Step 1: Service selection ────────────────────────────────────────────────
function StepService({
  services,
  selected,
  onSelect,
}: {
  services: Service[]
  selected: Service | null
  onSelect: (s: Service) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {services.map(svc => (
        <button
          key={svc.id}
          onClick={() => onSelect(svc)}
          className={`card p-4 text-left transition-all hover:border-brand-red/40 ${
            selected?.id === svc.id ? 'border-brand-red bg-brand-red/5' : ''
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
              {selected?.id === svc.id && (
                <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Step 2: Worker selection ─────────────────────────────────────────────────
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

// ─── Step 3: Date & time picker ───────────────────────────────────────────────
function StepDateTime({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeSelect,
  availability,
  barbershopId,
  workerId,
  serviceDuration,
}: {
  selectedDate: Date
  selectedTime: string | null
  onDateChange: (d: Date) => void
  onTimeSelect: (t: string) => void
  availability: Props['availability']
  barbershopId: string
  workerId: string
  serviceDuration: number
}) {
  const supabase = createClient()
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

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
        return
      }

      // Get existing bookings for this worker on this date
      const { data: existing } = await supabase
        .from('appointments')
        .select('starts_at, ends_at')
        .eq('worker_id', workerId)
        .gte('starts_at', `${dateStr}T00:00:00`)
        .lte('starts_at', `${dateStr}T23:59:59`)
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
    } finally {
      setLoadingSlots(false)
    }
  }

  return (
    <div>
      {/* Date strip */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => { setWeekOffset(o => o - 1); if (weekOffset > 0) {} }}
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
            {slots.map(slot => (
              <button
                key={slot}
                onClick={() => onTimeSelect(slot)}
                className={`py-2 px-1 rounded-lg text-sm font-medium border transition-all ${
                  selectedTime === slot
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg))] hover:border-brand-red hover:text-brand-red'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </>
      ) : slots.length === 0 && !loadingSlots ? (
        <div className="text-center py-6 text-[rgb(var(--fg-secondary))] text-sm">
          Selecciona un día disponible para ver horarios
        </div>
      ) : null}
    </div>
  )
}

// ─── Step 4: Confirm ──────────────────────────────────────────────────────────
function StepConfirm({
  barbershopId,
  service,
  worker,
  date,
  time,
  onSuccess,
}: {
  barbershopId: string
  service: Service
  worker: Worker
  date: Date
  time: string
  onSuccess: (appointmentId: string, cancelToken: string) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })

  const startsAt = `${format(date, 'yyyy-MM-dd')}T${time}:00`
  const endDate = new Date(`${format(date, 'yyyy-MM-dd')}T${time}:00`)
  endDate.setMinutes(endDate.getMinutes() + service.duration_minutes)
  const endsAt = endDate.toISOString().slice(0, 19)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error('Nombre y teléfono son requeridos')
    }

    setLoading(true)
    const cancelToken = crypto.randomUUID().replace(/-/g, '')
    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          barbershop_id: barbershopId,
          worker_id: worker.id,
          service_id: service.id,
          client_name: form.name.trim(),
          client_phone: form.phone.trim().startsWith('+') ? form.phone.trim() : `+56${form.phone.trim()}`,
          notes: form.notes.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'pending_payment',
          cancel_token: cancelToken,
        })
        .select('id')
        .single()

      if (error) throw error

      // Enviar notificación WhatsApp al cliente
      fetch('/api/whatsapp/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: data.id }),
      }).catch(() => {}) // No bloquear si falla (Twilio puede no estar configurado en dev)

      onSuccess(data.id, cancelToken)
    } catch (err: any) {
      toast.error(err.message || 'Error al reservar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Summary */}
      <div className="card p-4 mb-5 flex flex-col gap-2">
        <h3 className="font-semibold text-sm text-[rgb(var(--fg-secondary))] uppercase tracking-wide">
          Resumen de tu reserva
        </h3>
        <div className="flex items-center gap-2">
          <Scissors size={14} className="text-brand-red" />
          <span className="text-sm font-medium text-[rgb(var(--fg))]">{service.name}</span>
          <span className="ml-auto text-sm font-bold text-[rgb(var(--fg))]">{formatPrice(service.price)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-[8px] font-bold">
            {worker.name.charAt(0)}
          </div>
          <span className="text-sm text-[rgb(var(--fg))]">{worker.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-brand-red" />
          <span className="text-sm text-[rgb(var(--fg))]">
            {format(date, "EEE d 'de' MMMM", { locale: es })} · {time} ({service.duration_minutes} min)
          </span>
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

// ─── Success screen ───────────────────────────────────────────────────────────
function BookingSuccess({ service, worker, date, time, barbershop, cancelToken }: any) {
  const dateLabel = format(date, "EEEE d 'de' MMMM", { locale: es })
  const priceLabel = formatPrice(service.price)

  // Build pre-filled WhatsApp message
  const waMessage = [
    `Hola! Reservé una hora en ${barbershop.name}.`,
    ``,
    `*Detalle:*`,
    `- Servicio: ${service.name}`,
    `- Barbero: ${worker.name}`,
    `- Fecha: ${dateLabel} a las ${time}`,
    `- Precio: ${priceLabel}`,
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
          Para confirmar tu hora, envía el comprobante de transferencia por WhatsApp.
        </p>
      </div>

      {/* Resumen */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Servicio</span>
            <span className="font-medium text-[rgb(var(--fg))]">{service.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Barbero</span>
            <span className="font-medium text-[rgb(var(--fg))]">{worker.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--fg-secondary))]">Fecha y hora</span>
            <span className="font-medium text-[rgb(var(--fg))]">
              {format(date, "d MMM", { locale: es })} · {time}
            </span>
          </div>
          <div className="flex justify-between border-t border-[rgb(var(--fg-secondary))]/10 pt-2 mt-1">
            <span className="text-[rgb(var(--fg-secondary))]">Total a transferir</span>
            <span className="font-bold text-brand-red text-base">{priceLabel}</span>
          </div>
        </div>
      </div>

      {/* Datos de transferencia */}
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

      {/* CTA WhatsApp */}
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
          <a
            href={`/cancelar/${cancelToken}`}
            className="text-brand-red hover:underline"
          >
            Cancelar mi cita
          </a>
        </p>
      )}
    </div>
  )
}

// ─── Main booking flow ────────────────────────────────────────────────────────
const STEPS = ['Servicio', 'Barbero', 'Fecha y hora', 'Confirmar']

export function BookingFlow({ barbershop, services, workers, availability }: Props) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ id: string; cancelToken: string } | null>(null)

  const canProceed = () => {
    if (step === 0) return !!selectedService
    if (step === 1) return !!selectedWorker
    if (step === 2) return !!selectedTime
    return false
  }

  const handleNext = () => {
    if (canProceed()) setStep(s => s + 1)
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      {/* Shop header */}
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
            {/* Mini logo */}
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
            service={selectedService}
            worker={selectedWorker}
            date={selectedDate}
            time={selectedTime}
            barbershop={barbershop}
            cancelToken={successData.cancelToken}
          />
        ) : (
          <>
            {/* Step tabs */}
            <div className="flex gap-1 mb-6">
              {STEPS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => i < step && setStep(i)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    i === step
                      ? 'bg-brand-red text-white'
                      : i < step
                      ? 'bg-brand-red/10 text-brand-red cursor-pointer'
                      : 'bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))] cursor-not-allowed opacity-50'
                  }`}
                >
                  {i < step ? '✓' : i + 1} {label}
                </button>
              ))}
            </div>

            {/* Step content */}
            {step === 0 && (
              <StepService
                services={services}
                selected={selectedService}
                onSelect={svc => {
                  setSelectedService(svc)
                  setSelectedTime(null) // resetear hora si cambia servicio
                  setStep(1)
                }}
              />
            )}
            {step === 1 && (
              <StepWorker
                workers={workers}
                selected={selectedWorker}
                onSelect={wk => {
                  setSelectedWorker(wk)
                  setSelectedTime(null) // resetear hora si cambia barbero
                  setStep(2)
                }}
              />
            )}
            {step === 2 && selectedService && selectedWorker && (
              <>
                <StepDateTime
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onDateChange={setSelectedDate}
                  onTimeSelect={t => { setSelectedTime(t) }}
                  availability={availability}
                  barbershopId={barbershop.id}
                  workerId={selectedWorker.id}
                  serviceDuration={selectedService.duration_minutes}
                />
                {selectedTime && (
                  <button onClick={() => setStep(3)} className="btn-primary w-full mt-4">
                    Continuar <ChevronRight size={16} className="inline ml-1" />
                  </button>
                )}
              </>
            )}
            {step === 3 && selectedService && selectedWorker && selectedTime && (
              <StepConfirm
                barbershopId={barbershop.id}
                service={selectedService}
                worker={selectedWorker}
                date={selectedDate}
                time={selectedTime}
                onSuccess={(id, cancelToken) => setSuccessData({ id, cancelToken })}
              />
            )}

            {/* Back button */}
            {step > 0 && step < 3 && (
              <button
                onClick={() => setStep(s => s - 1)}
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
