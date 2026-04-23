import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM! // 'whatsapp:+14155238886'

async function sendWhatsApp(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

  const res = await fetch(url, {
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

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Twilio error: ${err.message}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const { appointment_id } = await req.json()
    if (!appointment_id) {
      return NextResponse.json({ message: 'appointment_id requerido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch appointment with all related data
    const { data: appt, error } = await supabase
      .from('appointments')
      .select(`
        id, client_name, client_phone, starts_at, ends_at, cancel_token,
        services(name, price, duration_minutes),
        workers(name),
        barbershops(name, transfer_info, phone)
      `)
      .eq('id', appointment_id)
      .single()

    if (error || !appt) {
      return NextResponse.json({ message: 'Cita no encontrada' }, { status: 404 })
    }

    const shop = appt.barbershops as any
    const service = appt.services as any
    const worker = appt.workers as any

    const date = new Date(appt.starts_at)
    const dateStr = date.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    const timeStr = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancelar/${appt.cancel_token}`

    const price = service?.price
      ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(service.price)
      : ''

    const transferBlock = shop?.transfer_info
      ? `\n💳 *Datos de transferencia:*\n${shop.transfer_info}\n\nEnvía el comprobante aquí mismo para confirmar tu hora.`
      : ''

    const message = `✂️ *¡Hola ${appt.client_name}!*

Tu hora en *${shop?.name}* está *pendiente de pago*.

📋 *Detalle:*
• Servicio: ${service?.name}
• Barbero: ${worker?.name}
• Fecha: ${dateStr}
• Hora: ${timeStr}
• Precio: ${price}
${transferBlock}

❌ Para cancelar: ${cancelUrl}

_Te recordaremos 24h y 1h antes de tu cita._`

    await sendWhatsApp(appt.client_phone, message)

    // Log notification sent
    await supabase
      .from('appointments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', appointment_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('WhatsApp notify error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
