import { describe, it, expect } from 'vitest'
import {
  amountMatches,
  dedupeByGroup,
  selectReceiptTarget,
  type ParsedReceipt,
} from '@/lib/receipt-matching'

// Comprobante legible base (se sobreescriben campos por caso)
function receipt(overrides: Partial<ParsedReceipt> = {}): ParsedReceipt {
  return {
    amount: 10000,
    date: '10-07-2026',
    is_valid_receipt: true,
    confidence: 0.9,
    recipient_ok: true,
    ...overrides,
  }
}

// Candidata mínima: id + monto esperado
type Cand = { id: string; booking_group_id?: string | null; amount: number }
const expectedOf = (c: Cand) => c.amount

describe('amountMatches', () => {
  it('acepta un monto dentro del ±5%', () => {
    expect(amountMatches(receipt({ amount: 10400 }), 10000)).toBe(true)
    expect(amountMatches(receipt({ amount: 9600 }), 10000)).toBe(true)
  })

  it('rechaza un monto fuera del ±5%', () => {
    expect(amountMatches(receipt({ amount: 10600 }), 10000)).toBe(false)
    expect(amountMatches(receipt({ amount: 9000 }), 10000)).toBe(false)
  })

  it('rechaza si el comprobante no es válido, la confianza es baja o el monto es null', () => {
    expect(amountMatches(receipt({ is_valid_receipt: false }), 10000)).toBe(false)
    expect(amountMatches(receipt({ confidence: 0.5 }), 10000)).toBe(false)
    expect(amountMatches(receipt({ amount: null }), 10000)).toBe(false)
  })
})

describe('dedupeByGroup', () => {
  it('deja una sola candidata por reserva grupal y conserva la primera', () => {
    const rows = [
      { id: 'a1', booking_group_id: 'g1', amount: 20000 },
      { id: 'a2', booking_group_id: 'g1', amount: 20000 },
      { id: 'b1', booking_group_id: null, amount: 10000 },
    ]
    const out = dedupeByGroup(rows)
    expect(out.map(r => r.id)).toEqual(['a1', 'b1'])
  })

  it('trata las reservas individuales (sin grupo) como distintas', () => {
    const rows = [
      { id: 'x', booking_group_id: null, amount: 10000 },
      { id: 'y', booking_group_id: null, amount: 15000 },
    ]
    expect(dedupeByGroup(rows).map(r => r.id)).toEqual(['x', 'y'])
  })
})

describe('selectReceiptTarget', () => {
  it('con una sola candidata la elige (el monto lo valida evaluateReceipt después)', () => {
    const cands: Cand[] = [{ id: 'only', amount: 99999 }]
    const res = selectReceiptTarget(cands, receipt({ amount: 10000 }), expectedOf)
    expect(res).toEqual({ kind: 'target', target: cands[0] })
  })

  it('con varias candidatas elige la que coincide en monto, no la más antigua (el bug)', () => {
    // cands[0] es la más próxima (antigua); el comprobante es de la segunda.
    const cands: Cand[] = [
      { id: 'vieja', amount: 8000 },
      { id: 'pagada', amount: 15000 },
    ]
    const res = selectReceiptTarget(cands, receipt({ amount: 15000 }), expectedOf)
    expect(res).toEqual({ kind: 'target', target: cands[1] })
  })

  it('con varias candidatas y comprobante ilegible devuelve unreadable', () => {
    const cands: Cand[] = [
      { id: 'a', amount: 8000 },
      { id: 'b', amount: 15000 },
    ]
    expect(selectReceiptTarget(cands, receipt({ is_valid_receipt: false }), expectedOf))
      .toEqual({ kind: 'unreadable' })
    expect(selectReceiptTarget(cands, receipt({ confidence: 0.4 }), expectedOf))
      .toEqual({ kind: 'unreadable' })
    expect(selectReceiptTarget(cands, receipt({ amount: null }), expectedOf))
      .toEqual({ kind: 'unreadable' })
  })

  it('con varias candidatas y ningún monto que coincida devuelve no_match', () => {
    const cands: Cand[] = [
      { id: 'a', amount: 8000 },
      { id: 'b', amount: 15000 },
    ]
    const res = selectReceiptTarget(cands, receipt({ amount: 30000 }), expectedOf)
    expect(res).toEqual({ kind: 'no_match' })
  })

  it('si varias candidatas empatan en monto elige la más próxima (primera)', () => {
    const cands: Cand[] = [
      { id: 'proxima', amount: 10000 },
      { id: 'lejana', amount: 10000 },
    ]
    const res = selectReceiptTarget(cands, receipt({ amount: 10000 }), expectedOf)
    expect(res).toEqual({ kind: 'target', target: cands[0] })
  })
})
