'use client'

import { useCallback, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useDismiss } from '@/components/scheduling/use-dismiss'

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

interface Props {
  value: string // 'HH:mm' (acepta 'HH:mm:ss' como viene de PostgreSQL)
  onChange: (value: string) => void
  // Solo se pueden elegir horas estrictamente posteriores (p.ej. cierre > apertura)
  after?: string
  // Lado desde el que se alinea el desplegable; 'right' para campos pegados al
  // borde derecho, así no se sale de la pantalla en el celular.
  align?: 'left' | 'right'
  className?: string
}

// Selector de hora con el mismo estilo que DatePicker: primero la hora en una
// grilla y luego los minutos (cada 15, igual que la granularidad mínima de
// reservas). Al elegir los minutos se cierra.
export function TimePicker({ value, onChange, after, align = 'left', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(rootRef, open, close)

  const current = value.slice(0, 5)
  const [hour, minute] = current.split(':')
  const min = after?.slice(0, 5)

  // Una hora sirve si al menos uno de sus minutos queda después de `after`
  const hourDisabled = (h: string) => !!min && `${h}:45` <= min
  const minuteDisabled = (m: string) => !!min && `${hour}:${m}` <= min

  const pickHour = (h: string) => {
    // Conserva los minutos si siguen siendo válidos; si no, toma el primero que sirva
    const keep = !min || `${h}:${minute}` > min
    const m = keep ? minute : MINUTES.find(x => `${h}:${x}` > min!) ?? '00'
    onChange(`${h}:${m}`)
  }

  const pickMinute = (m: string) => {
    onChange(`${hour}:${m}`)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`input text-sm py-1.5 px-3 flex items-center gap-2 text-left tabular-nums ${
          open ? 'ring-2 ring-brand-red/30 border-brand-red' : ''
        }`}
      >
        <Clock size={14} className="text-[rgb(var(--fg-secondary))] shrink-0" />
        {current}
      </button>

      {open && (
        <div
          role="dialog"
          className={`absolute z-30 mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 shadow-xl`}
        >
          <p className="text-[10px] font-medium uppercase text-[rgb(var(--fg-secondary))] mb-1.5">Hora</p>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map(h => {
              const selected = h === hour
              const disabled = hourDisabled(h)
              return (
                <button
                  key={h}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickHour(h)}
                  className={`h-8 rounded-full text-sm tabular-nums transition-all ${
                    selected
                      ? 'bg-brand-red text-white font-semibold'
                      : disabled
                      ? 'text-[rgb(var(--fg-secondary))]/30 cursor-not-allowed'
                      : 'text-[rgb(var(--fg))] hover:bg-brand-red/10'
                  }`}
                >
                  {h}
                </button>
              )
            })}
          </div>

          <p className="text-[10px] font-medium uppercase text-[rgb(var(--fg-secondary))] mt-3 mb-1.5 pt-2 border-t border-[rgb(var(--border))]">
            Minutos
          </p>
          <div className="grid grid-cols-4 gap-1">
            {MINUTES.map(m => {
              const selected = m === minute
              const disabled = minuteDisabled(m)
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickMinute(m)}
                  className={`h-8 rounded-full text-sm tabular-nums transition-all ${
                    selected
                      ? 'bg-brand-red text-white font-semibold'
                      : disabled
                      ? 'text-[rgb(var(--fg-secondary))]/30 cursor-not-allowed'
                      : 'text-[rgb(var(--fg))] hover:bg-brand-red/10'
                  }`}
                >
                  :{m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
