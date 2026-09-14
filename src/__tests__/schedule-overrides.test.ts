import { describe, it, expect } from 'vitest'
import {
  enumerateDates, getDayAvailability, groupOverrideRanges, isWithinOpeningHours, toChileWall, type DateOverride,
} from '@/lib/utils'

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

describe('enumerateDates', () => {
  it('incluye ambos extremos', () => {
    expect(enumerateDates('2026-12-24', '2026-12-26')).toEqual(['2026-12-24', '2026-12-25', '2026-12-26'])
  })

  it('un solo día', () => {
    expect(enumerateDates('2026-12-24', '2026-12-24')).toEqual(['2026-12-24'])
  })

  it('cruza de mes y de año', () => {
    expect(enumerateDates('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('no se salta días en el cambio de horario de Chile', () => {
    // Chile cambia de hora a comienzos de abril y de septiembre
    expect(enumerateDates('2026-04-03', '2026-04-06')).toHaveLength(4)
    expect(enumerateDates('2026-09-04', '2026-09-07')).toHaveLength(4)
  })
})

describe('groupOverrideRanges', () => {
  const closed = (date: string, label: string | null = 'Vacaciones'): DateOverride =>
    ({ date, is_closed: true, start_time: null, end_time: null, label })
  const open = (date: string, start = '10:00:00', end = '14:00:00'): DateOverride =>
    ({ date, is_closed: false, start_time: start, end_time: end, label: null })

  it('agrupa días seguidos con la misma configuración', () => {
    const groups = groupOverrideRanges([closed('2027-01-02'), closed('2027-01-01'), closed('2026-12-31')])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ start: '2026-12-31', end: '2027-01-02' })
    expect(groups[0].items).toHaveLength(3)
  })

  it('separa cuando hay un día de por medio', () => {
    const groups = groupOverrideRanges([closed('2026-12-24'), closed('2026-12-26')])
    expect(groups.map(g => [g.start, g.end])).toEqual([['2026-12-24', '2026-12-24'], ['2026-12-26', '2026-12-26']])
  })

  it('separa días seguidos con distinta configuración o nombre', () => {
    const groups = groupOverrideRanges([
      open('2026-12-24'),
      closed('2026-12-25', 'Navidad'),
      closed('2026-12-26', 'Vacaciones'),
      open('2026-12-27', '10:00', '13:00'),
    ])
    expect(groups).toHaveLength(4)
  })

  it('considera iguales las horas con y sin segundos', () => {
    const groups = groupOverrideRanges([open('2026-12-24', '10:00:00', '14:00:00'), open('2026-12-25', '10:00', '14:00')])
    expect(groups).toHaveLength(1)
  })
})
