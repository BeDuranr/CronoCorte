// Lógica pura para asignar un comprobante de transferencia a la cita correcta
// cuando un mismo teléfono tiene varias reservas pendientes de pago.
// Sin dependencias de red (Groq/Supabase) para poder testearla de forma aislada.

export interface ParsedReceipt {
  amount: number | null
  date: string | null
  is_valid_receipt: boolean
  confidence: number
  // Datos del DESTINATARIO extraídos del comprobante (no del origen). Cualquiera
  // puede venir null: distintos bancos muestran distintos campos (a veces solo el
  // nombre, a veces la cuenta enmascarada, etc.). La decisión de si coincide se
  // toma en código con matchRecipient, no la juzga el modelo de visión.
  recipient_name: string | null
  recipient_rut: string | null
  recipient_account: string | null
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

// ─────────────────────────────────────────────────────────────────────────────
// Matching de destinatario (determinístico, multi-señal)
//
// Problema: no todos los bancos muestran los mismos datos del destinatario. Unos
// muestran el N° de cuenta completo, otros lo enmascaran ("****9195"), otros solo
// el nombre, otros el RUT. Delegarle la decisión al modelo de visión daba falsos
// rechazos (rechazar a un cliente que SÍ pagó), que es el peor error de negocio.
//
// Estrategia: aprobar salvo que haya evidencia POSITIVA de un destinatario
// equivocado. Como el monto y la fecha ya se validaron antes, la probabilidad de
// que otra persona haya transferido el mismo monto el mismo día a otra cuenta es
// bajísima; ante la duda, se aprueba (y se marca para revisión manual).
//
// - N° de cuenta y RUT son señales FUERTES y precisas: si una coincide → aprueba;
//   si contradice → rechaza.
// - El nombre es una señal DÉBIL (OCR, nombres parciales, mayúsculas): coincidencia
//   parcial aprueba, pero una discrepancia de nombre por sí sola NO rechaza (queda
//   en 'review'), para no bloquear pagos reales por un mal reconocimiento del texto.
export type RecipientMatch = 'match' | 'mismatch' | 'review'

type SignalState = 'match' | 'contradict' | 'absent'

// Palabras de la config de la barbería que NO son parte del nombre del titular.
const NAME_NOISE = new Set([
  'banco', 'bci', 'cuenta', 'corriente', 'vista', 'ahorro', 'ahorros', 'rut',
  'chile', 'santander', 'estado', 'falabella', 'scotiabank', 'itau', 'security',
  'bice', 'ripley', 'consorcio', 'coopeuch', 'mach', 'machbank', 'tenpo', 'mercadopago',
  'tipo', 'numero', 'cta', 'com', 'gmail', 'hotmail', 'yahoo', 'outlook', 'net',
  'email', 'correo', 'de', 'del', 'la', 'el', 'transferencia', 'destinatario', 'titular',
])

// Solo dígitos (para comparar cuentas, tolerando puntos/espacios/enmascarado).
function onlyDigits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '')
}

// RUT normalizado: solo dígitos y K en mayúscula, sin puntos ni guión.
function normalizeRut(s: string | null | undefined): string {
  return (s ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
}

// Tokens de un nombre: minúsculas, sin tildes, solo letras, tokens de ≥2 chars.
function nameTokens(s: string | null | undefined): string[] {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
}

// Extrae del texto de configuración de la barbería (formato libre) los datos
// esperados del titular: RUT, candidatos a N° de cuenta y tokens del nombre.
function parseExpected(transferInfo: string): {
  rut: string
  accounts: string[]
  nameTokens: Set<string>
} {
  const rutMatch = transferInfo.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/)
  const rut = rutMatch ? normalizeRut(rutMatch[0]) : ''

  // Secuencias numéricas de ≥5 dígitos = candidatas a N° de cuenta. Se excluye el
  // RUT para no confundirlo con una cuenta.
  const accounts = (transferInfo.match(/\d[\d.\-]*\d/g) ?? [])
    .map(onlyDigits)
    .filter(d => d.length >= 5 && d !== rut)

  const tokens = new Set(nameTokens(transferInfo).filter(t => !NAME_NOISE.has(t)))
  return { rut, accounts, nameTokens: tokens }
}

// ¿La cuenta del comprobante coincide con alguna esperada? Compara por sufijo en
// ambos sentidos (≥4 dígitos) para tolerar cuentas enmascaradas ("****9195").
function accountMatches(receiptAccount: string, expected: string[]): boolean {
  if (receiptAccount.length < 4) return false
  return expected.some(exp => {
    const min = Math.min(exp.length, receiptAccount.length)
    if (min < 4) return false
    return exp.endsWith(receiptAccount) || receiptAccount.endsWith(exp)
  })
}

// Decide si el destinatario del comprobante corresponde a la barbería.
// `transferInfo` es la config de la barbería (texto libre). Devuelve:
//   'match'    → coincide (o no hay datos que contradigan) → aprobar.
//   'mismatch' → evidencia fuerte de otro destinatario → rechazar.
//   'review'   → ambiguo (p. ej. solo el nombre no calza) → aprobar y avisar al admin.
export function matchRecipient(parsed: ParsedReceipt, transferInfo: string): RecipientMatch {
  const expected = parseExpected(transferInfo)

  // ── Estado de cada señal ──
  const rcptRut = normalizeRut(parsed.recipient_rut)
  const rutState: SignalState =
    !rcptRut || !expected.rut ? 'absent' : rcptRut === expected.rut ? 'match' : 'contradict'

  const rcptAccount = onlyDigits(parsed.recipient_account)
  const accountState: SignalState =
    rcptAccount.length < 4 || expected.accounts.length === 0
      ? 'absent'
      : accountMatches(rcptAccount, expected.accounts)
        ? 'match'
        : 'contradict'

  const rcptName = nameTokens(parsed.recipient_name)
  const common = rcptName.filter(t => expected.nameTokens.has(t))
  const apellidoOk = rcptName.length > 0 && expected.nameTokens.has(rcptName[rcptName.length - 1])
  const nameState: SignalState =
    rcptName.length === 0 || expected.nameTokens.size === 0
      ? 'absent'
      : common.length >= 2 || apellidoOk
        ? 'match'
        : 'contradict'

  // ── Decisión ──
  const strongMatch = rutState === 'match' || accountState === 'match'
  const strongContradict = rutState === 'contradict' || accountState === 'contradict'

  if (strongMatch) return 'match'
  if (nameState === 'match' && !strongContradict) return 'match'
  // Una señal fuerte (cuenta/RUT) apunta claramente a otro y nada coincidió.
  if (strongContradict) return 'mismatch'
  // Sin ningún dato de destinatario en el comprobante: no puede contradecir.
  if (rutState === 'absent' && accountState === 'absent' && nameState === 'absent') return 'match'
  // Resto (típicamente solo el nombre no calza): ambiguo → aprobar y marcar revisión.
  return 'review'
}
