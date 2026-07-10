// Lógica pura para asignar un comprobante de transferencia a la cita correcta
// cuando un mismo teléfono tiene varias reservas pendientes de pago.
// Sin dependencias de red (Groq/Supabase) para poder testearla de forma aislada.

export interface ParsedReceipt {
  amount: number | null
  date: string | null
  is_valid_receipt: boolean
  confidence: number
  recipient_ok: boolean
}

// ¿El monto leído coincide (±5%) con el esperado y el comprobante es legible?
export function amountMatches(parsed: ParsedReceipt, expectedAmount: number): boolean {
  return (
    parsed.is_valid_receipt &&
    parsed.confidence >= 0.7 &&
    parsed.amount !== null &&
    Math.abs(parsed.amount - expectedAmount) < expectedAmount * 0.05
  )
}

// Deduplica reservas grupales (comparten booking_group_id): una candidata por reserva.
export function dedupeByGroup<T extends { id: string; booking_group_id?: string | null }>(rows: T[]): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const key = r.booking_group_id ?? r.id
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

export type ReceiptSelection<T> =
  | { kind: 'target'; target: T }
  | { kind: 'unreadable' }
  | { kind: 'no_match' }

// Elige a qué cita corresponde un comprobante entre varias candidatas pendientes.
// Precondición: `candidates` tiene al menos 1 elemento, ordenadas por proximidad
// (la cita más próxima primero).
//
// - 1 candidata  → esa (el monto lo valida después evaluateReceipt).
// - 2+ candidatas → la que coincida en monto (±5%). Si la imagen no es legible como
//   comprobante devuelve 'unreadable'; si ninguna coincide, 'no_match'; si varias
//   coinciden, la primera (más próxima).
export function selectReceiptTarget<T>(
  candidates: T[],
  parsed: ParsedReceipt,
  expectedOf: (c: T) => number
): ReceiptSelection<T> {
  if (candidates.length === 1) {
    return { kind: 'target', target: candidates[0] }
  }
  if (!parsed.is_valid_receipt || parsed.confidence < 0.7 || parsed.amount === null) {
    return { kind: 'unreadable' }
  }
  const matches = candidates.filter(c => amountMatches(parsed, expectedOf(c)))
  if (matches.length === 0) return { kind: 'no_match' }
  return { kind: 'target', target: matches[0] }
}
