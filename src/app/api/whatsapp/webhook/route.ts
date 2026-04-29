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

async function verifyPaymentReceipt(imageUrl: string, expectedAmount: number): Promise<{
  verified: boolean
  amount?: number
  reason: string
}> {
  try {
    // Fetch the image and convert to base64
    const imgRes = await fetch(imageUrl)
    const imgBuffer = await imgRes.arrayBuffer()
    const imgBase64 = Buffer.from(imgBuffer).toString('base64')
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

    const response = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imgBase64}` },
            },
            {
              type: 'text',
              text: `Analiza este comprobante de transferencia bancaria chilena.
Extrae el monto transferido, si es un comprobante válido y tu nivel de confianza.
Responde SOLO con JSON en este formato exacto (sin markdown):
{"amount": <número o null>, "is_valid_receipt": <true/false>, "confidence": <0.0-1.0>}`,
            },
          ],
        },
      ],
      max_tokens: 256,
    })

    const text = response.choices[0].message.content?.trim() ?? ''
    const json = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''))

    const verified =
      json.is_valid_receipt === true &&
      json.confidence >= 0.7 &&
      json.amount !== null &&
      Math.abs(json.amount - expectedAmount) < expectedAmount * 0.05 // ±5% tolerancia

    return {
      verified,
      amount: json.amount,
      reason: verified
        ? `Comprobante válido: $${json.amount?.toLocaleString('es-CL')}`
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
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`

  // Ordenar params y concatenar al URL
  const sortedParams = Array.from(body.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((str, [k, v]) => str + k + v, url)

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(sortedParams)
    .digest('base64')

  return crypto.timingSafeEqual(
    Buffer.from(twilioSignature),
    Buffer.from(expected)
  )
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
        id, client_name, status, payment_verified,
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
      const price = service?.price ?? 0

      await sendWhatsApp(from, `🔍 Verificando tu comprobante...`)

      const result = await verifyPaymentReceipt(mediaUrl, price)

      if (result.verified) {
        await supabase
          .from('appointments')
          .update({
            status: 'confirmed',
            payment_verified: true,
          })
          .eq('id', appointment.id)

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
          history: [], // WhatsApp no mantiene historial por ahora
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
