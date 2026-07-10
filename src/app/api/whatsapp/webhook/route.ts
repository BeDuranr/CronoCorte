import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'
import crypto from 'crypto'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!

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

interface ParsedReceipt {
  amount: number | null
  date: string | null
  is_valid_receipt: boolean
  confidence: number
  recipient_ok: boolean
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

    const recipientBlock = transferInfo
      ? `\nDatos del destinatario esperado:\n${transferInfo}\nReglas para recipient_ok:\n- true si el nombre del destinatario en el comprobante coincide (aunque sea parcial, sin importar mayúsculas/minúsculas)\n- true si el RUT del destinatario en el comprobante coincide\n- true si el número de cuenta coincide\n- true si el comprobante no muestra datos del destinatario\n- false SOLO si el comprobante muestra claramente un nombre o RUT diferente al esperado`
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
{"amount": <número o null>, "date": <"DD-MM-YYYY" o null>, "is_valid_receipt": <true/false>, "confidence": <0.0-1.0>, "recipient_ok": <true/false>}`,
            },
          ],
        },
      ],
      max_tokens: 256,
    })

    const text = response.choices[0].message.content?.trim() ?? ''
    const json = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''))
    return {
      parsed: {
        amount: json.amount ?? null,
        date: json.date ?? null,
        is_valid_receipt: json.is_valid_receipt === true,
        confidence: typeof json.confidence === 'number' ? json.confidence : 0,
        recipient_ok: json.recipient_ok === true,
      },
    }
  } catch (err) {
    console.error('Receipt read error:', err)
    return { error: 'Error al analizar imagen' }
  }
}

// ¿El monto leído coincide (±5%) con el esperado y el comprobante es legible?
function amountMatches(parsed: ParsedReceipt, expectedAmount: number): boolean {
  return (
    parsed.is_valid_receipt &&
    parsed.confidence >= 0.7 &&
    parsed.amount !== null &&
    Math.abs(parsed.amount - expectedAmount) < expectedAmount * 0.05
  )
}

// Evalúa un comprobante ya leído contra el monto esperado de UNA cita concreta.
function evaluateReceipt(
  parsed: ParsedReceipt,
  expectedAmount: number,
  transferInfo: string | null | undefined,
  todayChile: string
): { verified: boolean; amount?: number; reason: string; dateIssue?: boolean; recipientIssue?: boolean } {
  const amountOk = amountMatches(parsed, expectedAmount)
  const dateOk = isReceiptDateValid(parsed.date)
  const recipientOk = transferInfo ? parsed.recipient_ok === true : true

  if (amountOk && dateOk && !recipientOk) {
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

  const verified = amountOk && dateOk && recipientOk
  return {
    verified,
    amount: parsed.amount ?? undefined,
    reason: verified
      ? `Comprobante válido: $${parsed.amount?.toLocaleString('es-CL')} del ${parsed.date}`
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
    const messageBody = body.get('Body') ?? ''
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
        barbershops(id, name, phone, agent_enabled, agent_name, agent_tone, agent_prompt_custom, transfer_info, slug)
      `)
      .eq('client_phone', from)
      .eq('status', 'pending_payment')
      .order('starts_at', { ascending: true })

    // Deduplicar reservas grupales (comparten booking_group_id): una candidata por reserva.
    const candidates: any[] = []
    const seenGroups = new Set<string>()
    for (const appt of ((pendingAppointments as any[]) ?? [])) {
      const key = appt.booking_group_id ?? appt.id
      if (seenGroups.has(key)) continue
      seenGroups.add(key)
      candidates.push(appt)
    }

    // Para el branch del agente IA usamos la cita más próxima como contexto.
    const shop = candidates[0]?.barbershops as any

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

      // Elegir la cita objetivo. Con una sola candidata, esa. Con varias, la que
      // coincida en monto (±5%); si ninguna coincide, se rechaza; si empatan, la más próxima.
      let target: any
      if (candidates.length === 1) {
        target = candidates[0]
      } else if (!parsed.is_valid_receipt || parsed.confidence < 0.7 || parsed.amount === null) {
        // Con varias candidatas necesitamos el monto para desambiguar; si la imagen
        // no es legible como comprobante, pedimos una más clara (no "monto no coincide").
        await sendWhatsApp(
          from,
          `⚠️ No pudimos leer tu comprobante.\n\nPor favor envía una imagen más clara o contacta a la barbería directamente.`
        )
        return new NextResponse('<?xml version="1.0"?><Response></Response>', {
          headers: { 'Content-Type': 'text/xml' },
        })
      } else {
        const matches = candidates.filter(c => amountMatches(parsed, expectedOf(c)))
        if (matches.length === 0) {
          await sendWhatsApp(
            from,
            `⚠️ *Comprobante rechazado*\n\nEl monto del comprobante no coincide con ninguna de tus reservas pendientes. ` +
            `Revisa el monto transferido o contacta a la barbería.`
          )
          return new NextResponse('<?xml version="1.0"?><Response></Response>', {
            headers: { 'Content-Type': 'text/xml' },
          })
        }
        target = matches[0] // ya vienen ordenadas por starts_at asc
      }

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

        // Notificar al admin de la barbería
        if (targetShop?.phone) {
          await sendWhatsApp(
            targetShop.phone,
            `💰 Pago verificado\nCliente: ${target.client_name}\nServicio: ${service?.name}\n${result.reason}`
          )
        }
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

    // ── Si la barbería tiene agente IA, derivar al agente ──
    if (shop?.agent_enabled && messageBody) {
      const agentRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageBody,
          from,
          barbershop_id: shop.id,
          barbershop_slug: shop.slug,
          history: [],
        }),
      })

      const { reply } = await agentRes.json()
      if (reply) await sendWhatsApp(from, reply)

      return new NextResponse('<?xml version="1.0"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

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
