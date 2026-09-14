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
  value: string // 'yyyy-MM-dd' o '' si no hay fecha elegida
  onChange: (value: string) => void
  min?: string // 'yyyy-MM-dd'; los días anteriores quedan deshabilitados
  markedDates?: string[] // fechas con un punto (p.ej. ya tienen horario especial)
  placeholder?: string
}

// Selector de fecha con calendario desplegable, con el estilo de la app en vez
// del <input type="date"> nativo (que se ve distinto en cada navegador).
// Trabaja con fechas 'yyyy-MM-dd' "de pared", sin zona horaria.
export function DatePicker({ value, onChange, min, markedDates = [], placeholder = 'Elige una fecha' }: Props) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value || min || format(new Date(), 'yyyy-MM-dd'))))
  const rootRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismiss(rootRef, open, close)

  const toggle = () => {
    // Al abrir, mostrar el mes de la fecha elegida (o el mínimo)
    if (!open) setMonth(startOfMonth(parseISO(value || min || format(new Date(), 'yyyy-MM-dd'))))
    setOpen(o => !o)
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const marked = new Set(markedDates)
  const canGoBack = !min || format(month, 'yyyy-MM') > min.slice(0, 7)

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
        <span className={`first-letter:uppercase ${value ? '' : 'text-[rgb(var(--fg-secondary))]'}`}>
          {value ? format(parseISO(value), "EEE d 'de' MMMM yyyy", { locale: es }) : placeholder}
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

          <div className="grid grid-cols-7 gap-y-1">
            {days.map(day => {
              const str = format(day, 'yyyy-MM-dd')
              const inMonth = isSameMonth(day, month)
              const disabled = !!min && str < min
              const selected = str === value
              const isToday = str === min
              return (
                <button
                  key={str}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(str); setOpen(false) }}
                  className={`relative mx-auto w-9 h-9 rounded-full text-sm transition-all ${
                    selected
                      ? 'bg-brand-red text-white font-semibold'
                      : disabled
                      ? 'text-[rgb(var(--fg-secondary))]/30 cursor-not-allowed'
                      : `hover:bg-brand-red/10 ${inMonth ? 'text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg-secondary))]/60'}`
                  } ${isToday && !selected ? 'ring-1 ring-brand-red/50' : ''}`}
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
              )
            })}
          </div>

          {markedDates.length > 0 && (
            <p className="flex items-center gap-1.5 text-[10px] text-[rgb(var(--fg-secondary))] mt-2 pt-2 border-t border-[rgb(var(--border))]">
              <span className="w-1 h-1 rounded-full bg-brand-red" /> Ya tiene horario especial
            </p>
          )}
        </div>
      )}
    </div>
  )
}
