'use client'

import { useCallback, useRef, useState } from 'react'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth,
  parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDismiss } from '@/components/scheduling/use-dismiss'

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

interface Props {
  value: string // 'yyyy-MM-dd' o '' si no hay fecha elegida (inicio, en modo rango)
  endValue?: string // fin del rango ('' mientras no se elige); solo en modo rango
  // Modo simple: onChange(fecha, fecha). Modo rango: onChange(inicio, fin), con
  // fin = '' mientras falta el segundo clic.
  onChange: (start: string, end: string) => void
  range?: boolean
  min?: string // 'yyyy-MM-dd'; los días anteriores quedan deshabilitados
  markedDates?: string[] // fechas con un punto (p.ej. ya tienen horario especial)
  placeholder?: string
}

// Selector de fecha (o rango de fechas) con calendario desplegable, con el
// estilo de la app en vez del <input type="date"> nativo (que se ve distinto
// en cada navegador). Trabaja con fechas 'yyyy-MM-dd' "de pared", sin zona horaria.
export function DatePicker({
  value, endValue = '', onChange, range = false, min, markedDates = [], placeholder,
}: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value || min || format(new Date(), 'yyyy-MM-dd'))))
  const rootRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismiss(rootRef, open, close)

  const toggle = () => {
    // Al abrir, mostrar el mes de la fecha elegida (o el mínimo)
    if (!open) setMonth(startOfMonth(parseISO(value || min || format(new Date(), 'yyyy-MM-dd'))))
    setOpen(o => !o)
  }

  // Rango: el primer clic fija el inicio y el segundo el fin (tocar el mismo
  // día dos veces deja un rango de un solo día). Un clic antes del inicio lo
  // mueve; con el rango ya completo, un clic empieza uno nuevo.
  const pick = (str: string) => {
    if (!range) {
      onChange(str, str)
      setOpen(false)
      return
    }
    if (!value || endValue || str < value) {
      onChange(str, '')
      return
    }
    onChange(value, str)
    setOpen(false)
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const marked = new Set(markedDates)
  const canGoBack = !min || format(month, 'yyyy-MM') > min.slice(0, 7)

  // Fin efectivo para pintar el rango: el elegido, o el día bajo el cursor
  // mientras se elige el segundo extremo.
  const choosingEnd = range && !!value && !endValue
  const visualEnd = endValue || (choosingEnd && hovered && hovered >= value ? hovered : '')

  const shortDate = (d: string) => format(parseISO(d), "d 'de' MMM", { locale: es })
  const longDate = (d: string) => format(parseISO(d), "EEE d 'de' MMMM yyyy", { locale: es })
  const label = !value
    ? placeholder ?? (range ? 'Elige las fechas' : 'Elige una fecha')
    : !range || !endValue
    ? (range ? `${longDate(value)} → …` : longDate(value))
    : endValue === value
    ? longDate(value)
    : `${shortDate(value)} → ${shortDate(endValue)} ${endValue.slice(0, 4)}`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`input text-sm py-1.5 px-3 flex items-center gap-2 text-left ${
          open ? 'ring-2 ring-brand-red/30 border-brand-red' : ''
        }`}
      >
        <Calendar size={14} className="text-[rgb(var(--fg-secondary))] shrink-0" />
        <span className={`first-letter:uppercase truncate ${value ? '' : 'text-[rgb(var(--fg-secondary))]'}`}>
          {label}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMonth(m => addMonths(m, -1))}
              disabled={!canGoBack}
              className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-secondary))] disabled:opacity-30 transition-all"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-[rgb(var(--fg))] first-letter:uppercase">
              {format(month, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              type="button"
              onClick={() => setMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-secondary))] transition-all"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <span key={d} className="text-center text-[10px] font-medium uppercase text-[rgb(var(--fg-secondary))] py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1" onPointerLeave={() => setHovered(null)}>
            {days.map(day => {
              const str = format(day, 'yyyy-MM-dd')
              const inMonth = isSameMonth(day, month)
              const disabled = !!min && str < min
              const isStart = str === value
              const isEnd = !!visualEnd && str === visualEnd
              const selected = isStart || (!!endValue && str === endValue)
              const hasBand = range && !!value && !!visualEnd && visualEnd !== value
              const inBand = hasBand && str > value && str < visualEnd
              const isToday = str === min

              // Banda continua del rango: completa entre extremos y media banda
              // hacia adentro en el inicio y el fin.
              const band = !hasBand
                ? ''
                : inBand
                ? 'bg-brand-red/10'
                : isStart
                ? 'bg-gradient-to-r from-transparent from-50% to-brand-red/10 to-50%'
                : isEnd
                ? 'bg-gradient-to-l from-transparent from-50% to-brand-red/10 to-50%'
                : ''

              return (
                <div key={str} className={`flex justify-center ${band}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(str)}
                    onPointerEnter={() => setHovered(str)}
                    className={`relative w-9 h-9 rounded-full text-sm transition-all ${
                      selected
                        ? 'bg-brand-red text-white font-semibold'
                        : isEnd
                        ? 'border border-brand-red text-brand-red'
                        : disabled
                        ? 'text-[rgb(var(--fg-secondary))]/30 cursor-not-allowed'
                        : `hover:bg-brand-red/10 ${
                            inBand ? 'text-brand-red' : inMonth ? 'text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg-secondary))]/60'
                          }`
                    } ${isToday && !selected && !isEnd ? 'ring-1 ring-brand-red/50' : ''}`}
                  >
                    {format(day, 'd')}
                    {marked.has(str) && (
                      <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                          selected ? 'bg-white' : 'bg-brand-red'
                        }`}
                      />
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {(choosingEnd || markedDates.length > 0) && (
            <div className="flex flex-col gap-1 text-[10px] text-[rgb(var(--fg-secondary))] mt-2 pt-2 border-t border-[rgb(var(--border))]">
              {choosingEnd && <p>Ahora elige el último día (o toca el mismo para un solo día).</p>}
              {markedDates.length > 0 && (
                <p className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-brand-red" /> Ya tiene horario especial
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
