'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, addDays, startOfDay, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { toPng } from 'html-to-image'
import toast from 'react-hot-toast'
import { calculateSlotsWithStatus, type SlotStatus } from '@/lib/utils'
import { ChevronLeft, Download, Loader2, Moon, Sun, Scissors } from 'lucide-react'
import Link from 'next/link'

interface Barbershop {
  id: string
  name: string
  slug: string
  accent_color: string | null
  instagram: string | null
  slot_interval_minutes: number | null
}

interface AvailabilityRow {
  day_of_week: number
  start_time: string
  end_time: string
}

interface Props {
  barbershop: Barbershop
  workers: { id: string; name: string }[]
  availability: AvailabilityRow[]
}

const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920

function parseHex(hex: string | null | undefined): [number, number, number] {
  const DEFAULT: [number, number, number] = [230, 57, 70]
  if (!hex) return DEFAULT
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : DEFAULT
}

function rgba([r, g, b]: [number, number, number], alpha: number) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function groupSlots(slots: SlotStatus[]) {
  const morning: SlotStatus[] = [], afternoon: SlotStatus[] = [], night: SlotStatus[] = []
  slots.forEach(s => {
    const h = parseInt(s.time.split(':')[0])
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

// ── El "story" en sí: mismo lenguaje visual que booking-flow (bordes, radios,
// tachado en las horas ocupadas), renderizado a tamaño real 1080x1920 para
// que html-to-image lo capture con nitidez sin importar el zoom de vista previa.
function StoryCanvas({
  barbershop, dateLabel, slots, dark, accent, bookingHost,
}: {
  barbershop: Barbershop
  dateLabel: string
  slots: SlotStatus[]
  dark: boolean
  accent: [number, number, number]
  bookingHost: string
}) {
  const bg = dark ? '#0e0e0e' : '#ffffff'
  const fg = dark ? '#ffffff' : '#111111'
  const fgSecondary = dark ? '#828282' : '#646464'
  const border = dark ? '#202020' : '#e6e6e6'
  const accentSolid = rgba(accent, 1)
  const availableCount = slots.filter(s => !s.occupied).length
  const groups = groupSlots(slots)
  // bookingHost llega vacío en el primer render (server y cliente antes del
  // mount coinciden en "/slug") y se completa post-mount vía useEffect en
  // InstagramView — evita el mismatch de hidratación de usar window.location
  // directamente acá.
  const bookingUrl = bookingHost ? `${bookingHost}/${barbershop.slug}` : `/${barbershop.slug}`

  return (
    <div
      style={{
        width: STORY_WIDTH, height: STORY_HEIGHT, boxSizing: 'border-box',
        background: bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        overflow: 'hidden', position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, padding: '96px 72px 84px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 68, height: 68, borderRadius: 9999, background: accentSolid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Scissors size={34} color="#ffffff" strokeWidth={2} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: fgSecondary }}>Barbería</span>
            <span style={{ fontSize: 42, fontWeight: 800, color: fg, lineHeight: 1.1 }}>{barbershop.name}</span>
          </div>
        </div>

        {/* Fecha */}
        <div style={{ marginTop: 60 }}>
          <span style={{ display: 'inline-flex', padding: '12px 22px', borderRadius: 9999, background: rgba(accent, 0.12), color: accentSolid, fontSize: 22, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {dateLabel}
          </span>
        </div>

        {/* Título */}
        <div style={{ marginTop: 32 }}>
          <h1 style={{ margin: 0, fontSize: 66, fontWeight: 800, color: fg, lineHeight: 1.08 }}>Horas disponibles hoy</h1>
          <p style={{ margin: '14px 0 0', fontSize: 27, color: fgSecondary, fontWeight: 500 }}>
            {availableCount > 0 ? `${availableCount} horario${availableCount === 1 ? '' : 's'} libre${availableCount === 1 ? '' : 's'} para reservar` : 'Sin horarios libres por ahora'}
          </p>
        </div>

        {/* Grilla de horarios */}
        <div style={{ marginTop: 68, display: 'flex', flexDirection: 'column', gap: 46, flexGrow: 1, overflow: 'hidden' }}>
          {groups.map(({ label, slots: gs }) => (
            <div key={label}>
              <p style={{ margin: '0 0 20px', fontSize: 21, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: fgSecondary }}>{label}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 }}>
                {gs.map(({ time, occupied }) => (
                  <div
                    key={time}
                    style={{
                      padding: '26px 8px',
                      borderRadius: 16,
                      border: `${occupied ? 1 : 2}px solid ${occupied ? rgba(parseHex(fgSecondary), 0.14) : border}`,
                      textAlign: 'center',
                      fontSize: 32,
                      fontWeight: 700,
                      color: occupied ? rgba(parseHex(fgSecondary), 0.48) : fg,
                      textDecoration: occupied ? 'line-through' : 'none',
                    }}
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ width: '100%', boxSizing: 'border-box', background: accentSolid, color: '#ffffff', textAlign: 'center', padding: 30, borderRadius: 20, fontSize: 36, fontWeight: 800 }}>
            Reserva tu hora
          </div>
          <span style={{ fontSize: 23, color: fgSecondary, fontWeight: 600, letterSpacing: '0.02em' }}>
            {bookingUrl}{barbershop.instagram ? ` · @${barbershop.instagram}` : ''}
          </span>
        </div>

      </div>
    </div>
  )
}

export function InstagramView({ barbershop, workers, availability }: Props) {
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? '')
  // Arranca en el primer día con disponibilidad activa (no necesariamente
  // hoy) para no aterrizar en un día sin horarios y con la descarga bloqueada.
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = startOfDay(new Date())
    const activeDays = new Set(availability.map(a => a.day_of_week))
    for (let i = 0; i < 14; i++) {
      const day = addDays(today, i)
      if (activeDays.has(day.getDay())) return day
    }
    return today
  })
  const [dark, setDark] = useState(true)
  const [slots, setSlots] = useState<SlotStatus[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const storyRef = useRef<HTMLDivElement>(null)

  const accent = parseHex(barbershop.accent_color)
  const slotIntervalMinutes = barbershop.slot_interval_minutes ?? 60
  const today = startOfDay(new Date())
  const visibleDays = Array.from({ length: 14 }, (_, i) => addDays(today, i))
  const availableDaysOfWeek = useMemo(() => new Set(availability.map(a => a.day_of_week)), [availability])
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const dateLabel = format(selectedDate, "EEEE d 'de' MMMM", { locale: es })

  const [bookingHost, setBookingHost] = useState('')
  useEffect(() => { setBookingHost(window.location.host) }, [])

  useEffect(() => {
    if (!workerId) { setSlots([]); return }
    let cancelled = false

    const load = async () => {
      setLoadingSlots(true)
      try {
        const dow = selectedDate.getDay()
        const avail = availability.find(a => a.day_of_week === dow)
        if (!avail) { if (!cancelled) setSlots([]); return }

        let occupied: { starts_at: string; ends_at: string }[] = []
        try {
          const res = await fetch(`/api/availability?worker_id=${encodeURIComponent(workerId)}&date=${dateStr}`)
          if (res.ok) { const json = await res.json(); occupied = json.occupied ?? [] }
        } catch { occupied = [] }

        const withStatus = calculateSlotsWithStatus({
          availability: avail,
          existingAppointments: occupied,
          serviceDuration: slotIntervalMinutes,
          date: dateStr,
          slotIntervalMinutes,
        })
        if (!cancelled) setSlots(withStatus)
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [workerId, dateStr, availability, slotIntervalMinutes])

  const handleDownload = async () => {
    if (!storyRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(storyRef.current, {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        pixelRatio: 1,
      })
      const link = document.createElement('a')
      link.download = `${barbershop.slug}-horarios-${dateStr}.png`
      link.href = dataUrl
      link.click()
    } catch {
      toast.error('No se pudo generar la imagen')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all"
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Historia para Instagram</h1>
          <p className="text-sm text-[rgb(var(--fg-secondary))]">Descarga una imagen con las horas disponibles del día para publicar</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">

        {/* Vista previa */}
        <div className="flex flex-col items-center">
          <div
            className="rounded-2xl overflow-hidden border border-[rgb(var(--border))]"
            style={{ width: STORY_WIDTH / 3, height: STORY_HEIGHT / 3 }}
          >
            <div style={{ width: STORY_WIDTH, height: STORY_HEIGHT, transform: 'scale(0.3333)', transformOrigin: 'top left' }}>
              <div ref={storyRef}>
                <StoryCanvas barbershop={barbershop} dateLabel={dateLabel} slots={slots} dark={dark} accent={accent} bookingHost={bookingHost} />
              </div>
            </div>
          </div>
          {loadingSlots && (
            <p className="text-xs text-[rgb(var(--fg-secondary))] mt-3 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Calculando horarios…
            </p>
          )}
        </div>

        {/* Controles */}
        <div className="flex flex-col gap-4">

          {workers.length > 1 && (
            <div className="card p-4">
              <p className="label mb-2">Barbero</p>
              <select
                value={workerId}
                onChange={e => setWorkerId(e.target.value)}
                className="input"
              >
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}

          <div className="card p-4">
            <p className="label mb-2">Día</p>
            <div className="grid grid-cols-7 gap-1">
              {visibleDays.map((day, i) => {
                const isAvail = availableDaysOfWeek.has(day.getDay())
                const isSelected = format(day, 'yyyy-MM-dd') === dateStr
                const isPast = isBefore(day, today)
                return (
                  <button
                    key={i}
                    onClick={() => !isPast && isAvail && setSelectedDate(day)}
                    disabled={isPast || !isAvail}
                    className={`flex flex-col items-center py-2 px-0.5 rounded-lg text-center transition-all ${
                      isSelected ? 'bg-brand-red text-white' :
                      isPast || !isAvail ? 'opacity-25 cursor-not-allowed' :
                      'hover:bg-[rgb(var(--bg-secondary))]'
                    }`}
                  >
                    <span className="text-[9px] font-medium uppercase">{format(day, 'EEE', { locale: es }).slice(0, 2)}</span>
                    <span className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-[rgb(var(--fg))]'}`}>{format(day, 'd')}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card p-4">
            <p className="label mb-2">Fondo</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDark(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${dark ? 'bg-brand-red text-white border-brand-red' : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg))]'}`}
              >
                <Moon size={14} /> Oscuro
              </button>
              <button
                onClick={() => setDark(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${!dark ? 'bg-brand-red text-white border-brand-red' : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg))]'}`}
              >
                <Sun size={14} /> Claro
              </button>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading || loadingSlots || slots.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Descargar imagen
          </button>
        </div>
      </div>
    </main>
  )
}
