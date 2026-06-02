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

async function verifyPaymentReceipt(imageUrl: string, expectedAmount: number): Promise<{
  verified: boolean
  amount?: number
  reason: string
  dateIssue?: boolean
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
      return { verified: false, reason: 'No se pudo descargar la imagen' }
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
              text: `Analiza este comprobante de transferencia bancaria chilena.
La fecha de hoy es ${todayChile}.
Extrae el monto transferido, la fecha de la transacción y si es un comprobante válido.
La fecha debe estar en formato DD-MM-YYYY o YYYY-MM-DD.
Responde SOLO con JSON en este formato exacto (sin markdown):
{"amount": <número o null>, "date": <"DD-MM-YYYY" o null>, "is_valid_receipt": <true/false>, "confidence": <0.0-1.0>}`,
            },
          ],
        },
      ],
      max_tokens: 256,
    })

    const text = response.choices[0].message.content?.trim() ?? ''
    const json = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''))

    // Validar monto
    const amountOk =
      json.is_valid_receipt === true &&
      json.confidence >= 0.7 &&
      json.amount !== null &&
      Math.abs(json.amount - expectedAmount) < expectedAmount * 0.05 // ±5% tolerancia

    // Validar fecha — debe ser hoy o ayer
    const dateOk = isReceiptDateValid(json.date)

    if (amountOk && !dateOk) {
      return {
        verified: false,
        amount: json.amount,
        dateIssue: true,
        reason: `El comprobante tiene fecha ${json.date ?? 'no legible'}, pero debe ser de hoy (${todayChile}). Por favor envía una transferencia nueva.`,
      }
    }

    const verified = amountOk && dateOk

    return {
      verified,
      amount: json.amount,
      reason: verified
        ? `Comprobante válido: $${json.amount?.toLocaleString('es-CL')} del ${json.date}`
        : `No verificado: monto detectado $${json.amount?.toLocaleString('es-CL') ?? 'no legible'}, esperado $${expectedAmount.toLocaleString('es-CL')}`,
    }
  } catch (err) {
    console.error('Receipt verification error:', err)
    return { verified: false, reason: 'Error al analizar imagen' }
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

    // Buscar la cita más reciente pendiente de pago para este número
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        id, client_name, status, payment_verified, booking_group_id, total_amount,
        services(name, price),
        barbershops(id, name, phone, agent_enabled, agent_name, agent_tone, agent_prompt_custom, transfer_info, slug)
      `)
      .eq('client_phone', from)
      .eq('status', 'pending_payment')
      .order('starts_at', { ascending: true })
      .limit(1)
      .single()

    const shop = appointment?.barbershops as any

    // ── Si el cliente envió una imagen, intentar verificar como comprobante ──
    if (mediaUrl && mediaType?.startsWith('image/') && appointment) {
      const service = appointment.services as any

      // Monto esperado: si la reserva es grupal (o tiene total guardado), usar
      // total_amount; si no, caer al precio del servicio individual.
      const groupId = (appointment as any).booking_group_id as string | null
      const totalAmount = (appointment as any).total_amount as number | null
      const price = totalAmount ?? service?.price ?? 0

      await sendWhatsApp(from, `🔍 Verificando tu comprobante...`)

      const result = await verifyPaymentReceipt(mediaUrl, price)

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
            .eq('id', appointment.id)
        }

        await sendWhatsApp(
          from,
          `✅ *¡Pago verificado!* Tu hora en *${shop?.name}* está confirmada.\n\n` +
          `Te recordaremos 24h y 1h antes. ¡Nos vemos pronto! ✂️`
        )

        // Notificar al admin de la barbería
        if (shop?.phone) {
          await sendWhatsApp(
            shop.phone,
            `💰 Pago verificado\nCliente: ${appointment.client_name}\nServicio: ${service?.name}\n${result.reason}`
          )
        }
      } else if (result.dateIssue) {
        // Mensaje específico para comprobante con fecha incorrecta
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
