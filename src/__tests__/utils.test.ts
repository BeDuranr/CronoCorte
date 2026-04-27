import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toSlug,
  formatPrice,
  formatDate,
  formatTime,
  calculateAvailableSlots,
  cn,
} from '@/lib/utils'

// ─────────────────────────────────────────────
// cn (class merging)
// ─────────────────────────────────────────────
describe('cn', () => {
  it('combina clases simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('ignora valores falsy', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar')
  })

  it('resuelve conflictos de Tailwind correctamente', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})

// ─────────────────────────────────────────────
// toSlug
// ─────────────────────────────────────────────
describe('toSlug', () => {
  it('convierte a minúsculas', () => {
    expect(toSlug('Barber Club')).toBe('barber-club')
  })

  it('elimina acentos', () => {
    expect(toSlug('Barbería')).toBe('barberia')
    expect(toSlug('José')).toBe('jose')
    expect(toSlug('Ñoño')).toBe('nono')
  })

  it('reemplaza espacios por guiones', () => {
    expect(toSlug('mi barberia cool')).toBe('mi-barberia-cool')
  })

  it('elimina caracteres especiales', () => {
    expect(toSlug('Barber & Club!')).toBe('barber-club')
  })

  it('elimina espacios al inicio y al final', () => {
    expect(toSlug('  barber  ')).toBe('barber')
  })

  it('colapsa múltiples espacios en un guión', () => {
    expect(toSlug('barber   club')).toBe('barber-club')
  })

  it('permite números', () => {
    expect(toSlug('Barber 99')).toBe('barber-99')
  })

  it('maneja string vacío', () => {
    expect(toSlug('')).toBe('')
  })
})

// ─────────────────────────────────────────────
// formatPrice
// ─────────────────────────────────────────────
describe('formatPrice', () => {
  it('formatea precio en pesos chilenos', () => {
    const result = formatPrice(15000)
    expect(result).toContain('15')
    expect(result).toContain('000')
    // Debe incluir símbolo CLP o $
    expect(result.length).toBeGreaterThan(4)
  })

  it('formatea cero correctamente', () => {
    const result = formatPrice(0)
    expect(result).toContain('0')
  })

  it('no incluye decimales', () => {
    const result = formatPrice(1500)
    expect(result).not.toContain(',00')
    expect(result).not.toContain('.00')
  })

  it('formatea números grandes', () => {
    const result = formatPrice(1000000)
    expect(result).toContain('1')
    expect(result).toContain('000')
  })
})

// ─────────────────────────────────────────────
// formatDate
// ─────────────────────────────────────────────
describe('formatDate', () => {
  it('formatea una fecha en español', () => {
    const result = formatDate('2025-01-06')
    expect(result).toMatch(/lunes/i)
    expect(result).toContain('6')
    expect(result).toMatch(/enero/i)
  })

  it('acepta formato personalizado', () => {
    const result = formatDate('2025-06-15', 'dd/MM/yyyy')
    expect(result).toBe('15/06/2025')
  })
})

// ─────────────────────────────────────────────
// formatTime
// ─────────────────────────────────────────────
describe('formatTime', () => {
  it('extrae la hora en formato HH:mm', () => {
    expect(formatTime('2025-06-15T09:30:00')).toBe('09:30')
    expect(formatTime('2025-06-15T14:00:00')).toBe('14:00')
    expect(formatTime('2025-06-15T23:59:00')).toBe('23:59')
  })
})

// ─────────────────────────────────────────────
// calculateAvailableSlots
// ─────────────────────────────────────────────
describe('calculateAvailableSlots', () => {
  // Fecha futura para que los slots no sean "pasados"
  const FUTURE_DATE = '2099-12-31'

  const baseParams = {
    availability: { start_time: '09:00', end_time: '11:00' },
    existingAppointments: [],
    serviceDuration: 30,
    date: FUTURE_DATE,
  }

  it('genera slots cada 30 minutos dentro del horario', () => {
    const slots = calculateAvailableSlots(baseParams)
    expect(slots).toContain('09:00')
    expect(slots).toContain('09:30')
    expect(slots).toContain('10:00')
    expect(slots).toContain('10:30')
    expect(slots).not.toContain('11:00') // el servicio terminaría a las 11:30
  })

  it('retorna array vacío si el horario es demasiado corto para el servicio', () => {
    const slots = calculateAvailableSlots({
      ...baseParams,
      availability: { start_time: '09:00', end_time: '09:20' },
      serviceDuration: 30,
    })
    expect(slots).toHaveLength(0)
  })

  it('excluye slots ya reservados', () => {
    const slots = calculateAvailableSlots({
      ...baseParams,
      existingAppointments: [
        {
          starts_at: `${FUTURE_DATE}T09:00:00`,
          ends_at: `${FUTURE_DATE}T09:30:00`,
        },
      ],
    })
    expect(slots).not.toContain('09:00')
    expect(slots).toContain('09:30')
  })

  it('excluye slots que se solapan con una cita existente', () => {
    // Cita de 09:15 a 09:45 → bloquea slot 09:00 (termina en 09:30, se solapa)
    // y slot 09:30 (empieza antes de que termine la cita)
    const slots = calculateAvailableSlots({
      ...baseParams,
      existingAppointments: [
        {
          starts_at: `${FUTURE_DATE}T09:15:00`,
          ends_at: `${FUTURE_DATE}T09:45:00`,
        },
      ],
    })
    expect(slots).not.toContain('09:00')
    expect(slots).not.toContain('09:30')
    expect(slots).toContain('10:00')
  })

  it('acepta start_time con segundos (formato PostgreSQL)', () => {
    const slots = calculateAvailableSlots({
      ...baseParams,
      availability: { start_time: '09:00:00', end_time: '11:00:00' },
    })
    expect(slots).toContain('09:00')
    expect(slots.length).toBeGreaterThan(0)
  })

  it('no genera slots en el pasado', () => {
    // Fecha pasada → todos los slots deben estar vacíos
    const slots = calculateAvailableSlots({
      ...baseParams,
      date: '2000-01-01',
    })
    expect(slots).toHaveLength(0)
  })

  it('respeta servicios de mayor duración', () => {
    const slots = calculateAvailableSlots({
      ...baseParams,
      availability: { start_time: '09:00', end_time: '11:00' },
      serviceDuration: 60,
    })
    expect(slots).toContain('09:00')
    expect(slots).toContain('09:30')
    expect(slots).toContain('10:00')
    // 10:30 + 60min = 11:30 > 11:00, no debe aparecer
    expect(slots).not.toContain('10:30')
  })
})
