import { describe, it, expect } from 'vitest'
import { getDayAvailability, isWithinOpeningHours, toChileWall, type DateOverride } from '@/lib/utils'

// Horario semanal: lunes a viernes 10:00–20:00, sábado 10:00–14:00, domingo cerrado.
const WEEKLY = [1, 2, 3, 4, 5].map(d => ({ day_of_week: d, start_time: '10:00:00', end_time: '20:00:00' }))
  .concat([{ day_of_week: 6, start_time: '10:00:00', end_time: '14:00:00' }])

// 2026-12-24 es jueves, 2026-12-25 viernes, 2026-12-27 domingo.
const CHRISTMAS_EVE: DateOverride = { date: '2026-12-24', is_closed: false, start_time: '10:00:00', end_time: '14:00:00', label: 'Nochebuena' }
const CHRISTMAS: DateOverride = { date: '2026-12-25', is_closed: true, start_time: null, end_time: null, label: 'Navidad' }
const SPECIAL_SUNDAY: DateOverride = { date: '2026-12-27', is_closed: false, start_time: '11:00', end_time: '15:00' }
const OVERRIDES = [CHRISTMAS_EVE, CHRISTMAS, SPECIAL_SUNDAY]

describe('getDayAvailability', () => {
  it('usa el horario semanal cuando no hay horario especial', () => {
    expect(getDayAvailability('2026-12-23', WEEKLY, OVERRIDES)).toEqual({ start_time: '10:00:00', end_time: '20:00:00' })
  })

  it('el horario especial reemplaza al semanal en su fecha', () => {
    expect(getDayAvailability('2026-12-24', WEEKLY, OVERRIDES)).toEqual({ start_time: '10:00:00', end_time: '14:00:00' })
  })

  it('un día marcado como cerrado no tiene horario', () => {
    expect(getDayAvailability('2026-12-25', WEEKLY, OVERRIDES)).toBeNull()
  })

  it('puede abrir un día que normalmente está cerrado', () => {
    expect(getDayAvailability('2026-12-20', WEEKLY, OVERRIDES)).toBeNull() // domingo normal
    expect(getDayAvailability('2026-12-27', WEEKLY, OVERRIDES)).toEqual({ start_time: '11:00', end_time: '15:00' })
  })

  it('funciona sin horarios especiales', () => {
    expect(getDayAvailability('2026-12-26', WEEKLY)).toEqual({ start_time: '10:00:00', end_time: '14:00:00' })
  })
})

describe('toChileWall', () => {
  it('convierte a fecha y hora de pared en Chile (horario de verano, UTC-3)', () => {
    expect(toChileWall('2026-12-24T13:00:00Z')).toEqual({ date: '2026-12-24', time: '10:00' })
  })

  it('cruza de día cuando corresponde', () => {
    expect(toChileWall('2026-12-25T01:30:00Z')).toEqual({ date: '2026-12-24', time: '22:30' })
  })
})

describe('isWithinOpeningHours', () => {
  it('acepta una cita dentro del horario especial', () => {
    expect(isWithinOpeningHours('2026-12-24T12:00:00-03:00', '2026-12-24T13:00:00-03:00', WEEKLY, OVERRIDES)).toBe(true)
  })

  it('acepta una cita que termina justo al cierre', () => {
    expect(isWithinOpeningHours('2026-12-24T13:00:00-03:00', '2026-12-24T14:00:00-03:00', WEEKLY, OVERRIDES)).toBe(true)
  })

  it('rechaza una cita fuera del horario especial aunque el semanal la permitiría', () => {
    expect(isWithinOpeningHours('2026-12-24T16:00:00-03:00', '2026-12-24T17:00:00-03:00', WEEKLY, OVERRIDES)).toBe(false)
  })

  it('rechaza una cita que se pasa del cierre', () => {
    expect(isWithinOpeningHours('2026-12-24T13:30:00-03:00', '2026-12-24T14:30:00-03:00', WEEKLY, OVERRIDES)).toBe(false)
  })

  it('rechaza cualquier cita en un día cerrado', () => {
    expect(isWithinOpeningHours('2026-12-25T12:00:00-03:00', '2026-12-25T13:00:00-03:00', WEEKLY, OVERRIDES)).toBe(false)
  })

  it('rechaza citas antes de la apertura en un día normal', () => {
    expect(isWithinOpeningHours('2026-12-23T09:00:00-03:00', '2026-12-23T10:00:00-03:00', WEEKLY, OVERRIDES)).toBe(false)
  })

  it('evalúa en hora de Chile aunque el timestamp venga en UTC', () => {
    // 19:00Z = 16:00 en Chile → dentro del horario semanal del miércoles
    expect(isWithinOpeningHours('2026-12-23T19:00:00Z', '2026-12-23T20:00:00Z', WEEKLY, OVERRIDES)).toBe(true)
  })

  it('rechaza rangos que cruzan de día', () => {
    expect(isWithinOpeningHours('2026-12-23T19:30:00-03:00', '2026-12-24T00:30:00-03:00', WEEKLY, OVERRIDES)).toBe(false)
  })
})
