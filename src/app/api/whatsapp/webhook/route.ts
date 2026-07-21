import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ParsedReceipt, amountMatches, dedupeByGroup, selectReceiptTarget, matchRecipient } from '@/lib/receipt-matching'
import Groq from 'groq-sdk'
import crypto from 'crypto'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!

// Plantilla aprobada por Meta para avisar al dueño de un pago verificado.
// Un mensaje libre (Body) al dueño solo se entrega dentro de la ventana de 24h
// desde su última interacción con el número; fuera de ella Meta lo rechaza
// (error 63016). La plantilla es business-initiated y no tiene esa limitación.
const TEMPLATE_ADMIN_PAGO = process.env.TWILIO_TEMPLATE_ADMIN_PAGO ?? ''

async function sendWhatsApp(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: TWILIO_WHATSAPP_FROM,
      To: `whatsapp:${to}`,
      Body: body,
    }),
  })
}

// Normaliza un teléfono chileno al formato E.164 (+56XXXXXXXXX) que exige
// WhatsApp. Acepta "934135145", "+56 9 3413 5145", "56934135145", etc.
// Devuelve null si no se puede formar un número válido.
function normalizeChileanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('56')) digits = digits.slice(2)
  // Móvil chileno: 9 dígitos empezando en 9.
  if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`
  return null
}

// Sanitiza valores para variables de plantilla (Meta rechaza \n, tabs, $, #, %,
// +, 5+ espacios seguidos). Mismo criterio que /api/whatsapp/notify.
function ensureString(value: unknown) {
  return (value == null ? '' : String(value))
    .replace(/[\r\n]+/g, ' - ')
    .replace(/\t+/g, ' ')
    .replace(/\+/g, 'y')
    .replace(/[$#%]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// Avisa al dueño de la barbería de un pago verificado. Usa plantilla aprobada
// si está configurada (entrega garantizada), con fallback al mensaje libre.
// Loguea la respuesta de Twilio para diagnosticar entregas fallidas.
async function notifyAdminPago(
  shopPhone: string | null | undefined,
  vars: { cliente: string; servicio: string; detalle: string },
) {
  const to = normalizeChileanPhone(shopPhone)
  if (!to) {
    console.warn('notifyAdminPago: teléfono de barbería inválido, se omite aviso:', shopPhone)
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

  const params = new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: `whatsapp:${to}` })
  if (TEMPLATE_ADMIN_PAGO) {
    params.set('ContentSid', TEMPLATE_ADMIN_PAGO)
    params.set('ContentVariables', JSON.stringify({
      '1': ensureString(vars.cliente),
      '2': ensureString(vars.servicio),
      '3': ensureString(vars.detalle),
    }))
  } else {
    params.set('Body', `💰 Pago verificado\nCliente: ${vars.cliente}\nServicio: ${vars.servicio}\n${vars.detalle}`)
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    const data = await res.json().catch(() => ({}))
    console.log('notifyAdminPago Twilio response:', JSON.stringify({
      usedTemplate: !!TEMPLATE_ADMIN_PAGO,
      httpStatus: res.status,
      sid: data.sid,
      status: data.status,
      errorCode: data.error_code,
      errorMessage: data.error_message,
    }))
  } catch (err) {
    console.error('notifyAdminPago error:', err)
  }
}

// Retorna true si la fecha del comprobante es hoy o ayer (Chile, tolerancia nocturna)
function isReceiptDateValid(receiptDate: string | null): boolean {
  if (!receiptDate) return false

  try {
    // Normalizar separadores: "01/06/2026", "01-06-2026" o "2026-06-01"
    // Quitar parte de hora si viene incluida
    const clean = receiptDate.trim().split('T')[0].split(' ')[0].replace(/\//g, '-')
    const parts = clean.split('-').map(p => parseInt(p, 10))
    if (parts.length !== 3 || parts.some(isNaN)) return false

    // Detectar formato: si el primer componente tiene 4 dígitos => YYYY-MM-DD,
    // si no => DD-MM-YYYY (formato chileno típico de los comprobantes).
    let year: number, month: number, day: number
    if (clean.split('-')[0].length === 4) {
      // YYYY-MM-DD
      ;[year, month, day] = parts
    } else {
      // DD-MM-YYYY
      ;[day, month, year] = parts
    }

    // Validación básica de rangos
    if (month < 1 || month > 12 || day < 1 || day > 31) return false

    // Día del comprobante como número comparable: YYYYMMDD
    const receiptNum = year * 10000 + month * 100 + day

    // Fecha actual en Chile (formato es-CL da DD-MM-YYYY)
    const nowChileStr = new Date().toLocaleDateString('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const [cd, cm, cy] = nowChileStr.replace(/\//g, '-').split('-').map(p => parseInt(p, 10))
    const todayNum = cy * 10000 + cm * 100 + cd

    // Ayer (restando 1 día con un objeto Date en zona Chile)
    const nowChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
    nowChile.setDate(nowChile.getDate() - 1)
    const yesterdayNum =
      nowChile.getFullYear() * 10000 + (nowChile.getMonth() + 1) * 100 + nowChile.getDate()

    // Válido si el comprobante es de hoy o de ayer
    return receiptNum === todayNum || receiptNum === yesterdayNum
  } catch {
    return false
  }
}

// Extrae el primer objeto JSON balanceado de un texto, tolerando texto extra
// antes/después (el modelo a veces agrega una frase aunque se le pida "solo JSON").
function extractJsonObject(text: string): any {
  const stripped = text.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No se encontró un objeto JSON en la respuesta del modelo')
  }
  return JSON.parse(stripped.slice(start, end + 1))
}

// Lee el comprobante con el modelo de visión (una sola llamada) y devuelve los
// campos crudos. No decide si es válido: eso lo hace evaluateReceipt contra un
// monto esperado concreto. `transferInfo` se incluye para poder evaluar el
// destinatario; pásalo solo cuando se conoce la barbería destino.
async function readReceipt(imageUrl: string, transferInfo?: string | null): Promise<{
  parsed?: ParsedReceipt
  error?: string
}> {
  try {
    const twilioAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

    // Twilio puede redirigir — seguimos el redirect manualmente con credenciales
    let finalUrl = imageUrl
    const headRes = await fetch(imageUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${twilioAuth}` },
      redirect: 'manual',
    })
    if (headRes.status === 301 || headRes.status === 302 || headRes.status === 307) {
      finalUrl = headRes.headers.get('location') ?? imageUrl
    }

    const imgRes = await fetch(finalUrl, {
      headers: { Authorization: `Basic ${twilioAuth}` },
    })
    if (!imgRes.ok) {
      console.error('Failed to fetch Twilio media:', imgRes.status)
      return { error: 'No se pudo descargar la imagen' }
    }
    const imgBuffer = await imgRes.arrayBuffer()
    const imgBase64 = Buffer.from(imgBuffer).toString('base64')
    const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const validMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg'

    // Fecha de hoy en Chile para incluirla en el prompt como referencia
    const todayChile = new Date().toLocaleDateString('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    // Le pedimos al modelo que EXTRAIGA los datos del destinatario, no que juzgue
    // si coinciden: esa decisión la toma matchRecipient en código de forma
    // determinística (ver receipt-matching.ts). Así evitamos falsos rechazos.
    const recipientBlock = transferInfo
      ? `\nExtrae además los datos del DESTINATARIO (a quién se transfirió, NUNCA el origen/emisor):\n- recipient_name: nombre del destinatario tal cual aparece, o null si no aparece\n- recipient_rut: RUT del destinatario si aparece, o null\n- recipient_account: número de cuenta del destinatario si aparece, aunque esté parcial o enmascarado (ej: "****9195"), o null`
      : ''

    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${validMime};base64,${imgBase64}`, detail: 'high' },
            },
            {
              type: 'text',
              text: `Analiza esta imagen de un comprobante de transferencia bancaria chilena.
La fecha de hoy es ${todayChile}.
Extrae el monto transferido, la fecha de la transacción y evalúa si la imagen es un comprobante bancario real.
La fecha debe estar en formato DD-MM-YYYY o YYYY-MM-DD.
IMPORTANTE: is_valid_receipt debe ser true si la imagen parece un comprobante bancario legítimo, independientemente de a quién fue la transferencia.${recipientBlock}
Responde SOLO con JSON en este formato exacto (sin markdown):
{"amount": <número o null>, "date": <"DD-MM-YYYY" o null>, "is_valid_receipt": <true/false>, "confidence": <0.0-1.0>, "recipient_name": <string o null>, "recipient_rut": <string o null>, "recipient_account": <string o null>}`,
            },
          ],
        },
      ],
      // 256 se quedaba corto: con los campos de destinatario agregados, cualquier
      // preámbulo del modelo (aunque se le pida "solo JSON") cortaba la respuesta
      // a la mitad y el JSON.parse fallaba con TODO comprobante, calzara o no.
      max_tokens: 600,
    })

    const text = response.choices[0].message.content?.trim() ?? ''
    let json: any
    try {
      json = extractJsonObject(text)
    } catch (parseErr) {
      console.error('Receipt JSON parse error. Raw model output:', text)
      throw parseErr
    }
    return {
      parsed: {
        amount: json.amount ?? null,
        date: json.date ?? null,
        is_valid_receipt: json.is_valid_receipt === true,
        confidence: typeof json.confidence === 'number' ? json.confidence : 0,
        recipient_name: typeof json.recipient_name === 'string' ? json.recipient_name : null,
        recipient_rut: typeof json.recipient_rut === 'string' ? json.recipient_rut : null,
        recipient_account: typeof json.recipient_account === 'string' ? json.recipient_account : null,
      },
    }
  } catch (err) {
    console.error('Receipt read error:', err)
    return { error: 'Error al analizar imagen' }
  }
}

// Evalúa un comprobante ya leído contra el monto esperado de UNA cita concreta.
function evaluateReceipt(
  parsed: ParsedReceipt,
  expectedAmount: number,
  transferInfo: string | null | undefined,
  todayChile: string
): { verified: boolean; amount?: number; reason: string; dateIssue?: boolean; recipientIssue?: boolean; recipientReview?: boolean } {
  const amountOk = amountMatches(parsed, expectedAmount)
  const dateOk = isReceiptDateValid(parsed.date)
  // 'match' | 'mismatch' | 'review'. Sin transferInfo no podemos evaluar destinatario.
  const recipient = transferInfo ? matchRecipient(parsed, transferInfo) : 'match'

  // Solo rechazamos por destinatario cuando hay evidencia fuerte de otro (cuenta/RUT
  // distintos). Los casos ambiguos ('review') se aprueban y se avisan al admin.
  if (amountOk && dateOk && recipient === 'mismatch') {
    return {
      verified: false,
      amount: parsed.amount ?? undefined,
      recipientIssue: true,
      reason: `El comprobante no corresponde a una transferencia a esta barbería. Verifica que enviaste al destinatario correcto.`,
    }
  }

  if (amountOk && !dateOk) {
    return {
      verified: false,
      amount: parsed.amount ?? undefined,
      dateIssue: true,
      reason: `El comprobante tiene fecha ${parsed.date ?? 'no legible'}, pero debe ser de hoy (${todayChile}). Por favor envía una transferencia nueva.`,
    }
  }

  const verified = amountOk && dateOk && recipient !== 'mismatch'
  const recipientReview = verified && recipient === 'review'
  return {
    verified,
    amount: parsed.amount ?? undefined,
    recipientReview,
    reason: verified
      ? recipientReview
        ? `Comprobante válido (⚠️ destinatario no confirmado, revisar): $${parsed.amount?.toLocaleString('es-CL')} del ${parsed.date}`
        : `Comprobante válido: $${parsed.amount?.toLocaleString('es-CL')} del ${parsed.date}`
      : `No verificado: monto detectado $${parsed.amount?.toLocaleString('es-CL') ?? 'no legible'}, esperado $${expectedAmount.toLocaleString('es-CL')}`,
  }
}

// Verificar firma Twilio (HMAC-SHA1)
function verifyTwilioSignature(req: NextRequest, body: URLSearchParams): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false

  const twilioSignature = req.headers.get('x-twilio-signature') ?? ''
  if (!twilioSignature) return false

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`

  // Ordenar params y concatenar al URL
  const sortedParams = Array.from(body.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((str, [k, v]) => str + k + v, url)

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(sortedParams)
    .digest('base64')

  // timingSafeEqual lanza si los buffers tienen distinta longitud, por eso
  // comparamos longitudes primero y envolvemos en try/catch para devolver
  // false limpio ante una firma malformada en vez de crashear con 500.
  try {
    const sigBuf = Buffer.from(twilioSignature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

// Twilio sends form-encoded data
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = new URLSearchParams(rawBody)

    // Verificar que el request viene realmente de Twilio
    if (process.env.NODE_ENV === 'production') {
      if (!verifyTwilioSignature(req, body)) {
        console.warn('Invalid Twilio signature')
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const from = body.get('From')?.replace('whatsapp:', '') ?? ''
    const numMedia = parseInt(body.get('NumMedia') ?? '0')
    const mediaUrl = numMedia > 0 ? body.get('MediaUrl0') : null
    const mediaType = numMedia > 0 ? body.get('MediaContentType0') : null

    if (!from) return NextResponse.json({ ok: true })

    const supabase = createAdminClient()

    // Traer TODAS las citas pendientes de pago de este número. Puede haber más
    // de una (reservas repetidas o de distintas barberías); el comprobante se
    // asigna luego a la correcta por monto, no ciegamente a la más antigua.
    const { data: pendingAppointments } = await supabase
      .from('appointments')
      .select(`
        id, client_name, status, payment_verified, booking_group_id, total_amount, starts_at,
        services(name, price),
        barbershops(id, name, phone, transfer_info)
      `)
      .eq('client_phone', from)
      .eq('status', 'pending_payment')
      .order('starts_at', { ascending: true })

    // Deduplicar reservas grupales (comparten booking_group_id): una candidata por reserva.
    const candidates = dedupeByGroup((pendingAppointments as any[]) ?? [])

    // ── Si el cliente envió una imagen, intentar verificar como comprobante ──
    if (mediaUrl && mediaType?.startsWith('image/') && candidates.length > 0) {
      await sendWhatsApp(from, `🔍 Verificando tu comprobante...`)

      const todayChile = new Date().toLocaleDateString('es-CL', {
        timeZone: 'America/Santiago',
        day: '2-digit', month: '2-digit', year: 'numeric',
      })

      // Monto esperado de una candidata: total de la reserva o precio del servicio.
      const expectedOf = (c: any) =>
        (c.total_amount as number | null) ?? (c.services as any)?.price ?? 0

      // Datos del destinatario para el prompt: solo si todas las candidatas son
      // de la misma barbería (si no, no sabemos contra cuál validar el destinatario).
      const shopIds = new Set(candidates.map(c => (c.barbershops as any)?.id))
      const readTransferInfo = shopIds.size === 1 ? (candidates[0].barbershops as any)?.transfer_info : null

      const read = await readReceipt(mediaUrl, readTransferInfo)

      if (read.error || !read.parsed) {
        await sendWhatsApp(
          from,
          `⚠️ No pudimos verificar tu pago automáticamente.\n\n_${read.error ?? 'Error al analizar imagen'}_\n\n` +
          `Por favor envía una imagen más clara o contacta a la barbería directamente.`
        )
        return new NextResponse('<?xml version="1.0"?><Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
        })
      }
      const parsed = read.parsed

      // Elegir a qué cita corresponde el comprobante (por monto si hay varias).
      const selection = selectReceiptTarget(candidates, parsed, expectedOf)
      if (selection.kind === 'unreadable') {
        await sendWhatsApp(
          from,
          `⚠️ No pudimos leer tu comprobante.\n\nPor favor envía una imagen más clara o contacta a la barbería directamente.`
        )
        return new NextResponse('<?xml version="1.0"?><Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
        })
      }
      if (selection.kind === 'no_match') {
        await sendWhatsApp(
          from,
          `⚠️ *Comprobante rechazado*\n\nEl monto del comprobante no coincide con ninguna de tus reservas pendientes. ` +
          `Revisa el monto transferido o contacta a la barbería.`
        )
        return new NextResponse('<?xml version="1.0"?><Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
        })
      }
      const target = selection.target

      const targetShop = target.barbershops as any
      const service = target.services as any
      const groupId = target.booking_group_id as string | null
      const result = evaluateReceipt(parsed, expectedOf(target), readTransferInfo, todayChile)

      if (result.verified) {
        // Confirmar: si hay grupo, confirmar todas las citas del grupo; si no, solo esta.
        if (groupId) {
          await supabase
            .from('appointments')
            .update({ status: 'confirmed', payment_verified: true })
            .eq('booking_group_id', groupId)
        } else {
          await supabase
            .from('appointments')
            .update({ status: 'confirmed', payment_verified: true })
            .eq('id', target.id)
        }

        await sendWhatsApp(
          from,
          `✅ *¡Pago verificado!* Tu hora en *${targetShop?.name}* está confirmada.\n\n` +
          `Te recordaremos 24h y 1h antes. ¡Nos vemos pronto! ✂️`
        )

        // Notificar al admin de la barbería (plantilla si está configurada;
        // si no, mensaje libre — sujeto a la ventana de 24h de WhatsApp).
        await notifyAdminPago(targetShop?.phone, {
          cliente: target.client_name ?? 'Cliente',
          servicio: service?.name ?? 'Servicio',
          detalle: result.reason ?? '',
        })
      } else if (result.recipientIssue) {
        await sendWhatsApp(
          from,
          `⚠️ *Comprobante rechazado*\n\n${result.reason}\n\n` +
          `Si crees que es un error, contacta directamente a la barbería.`
        )
      } else if (result.dateIssue) {
        await sendWhatsApp(
          from,
          `⚠️ *Comprobante rechazado*\n\n${result.reason}\n\n` +
          `Si crees que es un error, contacta directamente a la barbería.`
        )
      } else {
        await sendWhatsApp(
          from,
          `⚠️ No pudimos verificar tu pago automáticamente.\n\n_${result.reason}_\n\n` +
          `Por favor envía una imagen más clara o contacta a la barbería directamente.`
        )
      }

      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // ── El cliente envió un archivo que NO es imagen (PDF, audio, video…) ──
    // El modelo de visión solo procesa imágenes, así que no se puede leer como
    // comprobante. Interceptamos aquí para guiar al cliente si está pagando.
    if (mediaUrl && !mediaType?.startsWith('image/')) {
      if (candidates.length > 0) {
        await sendWhatsApp(
          from,
          `📎 Recibimos tu archivo, pero para confirmar el pago necesitamos una *imagen* ` +
          `(foto o captura de pantalla) del comprobante. Los archivos PDF no se pueden procesar ` +
          `automáticamente.\n\nPor favor envía una captura, o contacta directamente a la barbería.`
        )
      }
      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Mensajes de texto que no son comprobante ni archivo: no se auto-responden
    // por WhatsApp. El agente de recomendación de cortes solo vive en la página web.
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
