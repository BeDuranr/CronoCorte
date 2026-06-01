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

  const data = await res.json()

  // Log detallado para diagnostico
  console.log('Twilio response:', JSON.stringify({
    httpStatus: res.status,
    sid: data.sid,
    status: data.status,
    errorCode: data.error_code,
    errorMessage: data.error_message,
    to: data.to,
    from: data.from,
  }))

  if (!res.ok) {
    throw new Error(`Twilio error ${res.status}: ${data.message || data.error_message}`)
  }

  // Twilio puede devolver 201 con error_code si el mensaje no se pudo entregar
  if (data.error_code) {
    throw new Error(`Twilio error_code ${data.error_code}: ${data.error_message}`)
  }

  return data
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
        id, client_name, client_phone, starts_at, ends_at, cancel_token, booking_group_id, total_amount,
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
    const groupId = (appt as any).booking_group_id as string | null
    const totalAmount = (appt as any).total_amount as number | null

    // Si es reserva grupal, traer todas las citas del grupo para listar los bloques
    let groupAppts: any[] = [appt]
    if (groupId) {
      const { data: all } = await supabase
        .from('appointments')
        .select(`starts_at, services(name)`)
        .eq('booking_group_id', groupId)
        .order('starts_at', { ascending: true })
      if (all && all.length) groupAppts = all
    }

    const date = new Date(appt.starts_at)
    const dateStr = date.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancelar/${appt.cancel_token}`

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

    // Monto a mostrar: total del grupo si existe, si no el precio del servicio
    const displayAmount = totalAmount ?? service?.price ?? 0

    const transferBlock = shop?.transfer_info
      ? `\n💳 *Datos de transferencia:*\n${shop.transfer_info}\n\nEnvía el comprobante aquí mismo para confirmar tu hora.`
      : ''

    const isGroup = !!groupId && groupAppts.length > 1

    // Construir el bloque de detalle (1 o varias personas)
    let detalle: string
    if (isGroup) {
      const lineas = groupAppts.map((a, i) => {
        const t = new Date(a.starts_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        const svcName = (a.services as any)?.name ?? 'Servicio'
        const quien = i === 0 ? 'Tú' : `Acompañante ${i}`
        return `• ${quien}: ${svcName} a las ${t}`
      })
      detalle = `📋 *Detalle (${groupAppts.length} personas):*\n${lineas.join('\n')}\n• Barbero: ${worker?.name}\n• Fecha: ${dateStr}\n• Total: ${fmt(displayAmount)}`
    } else {
      const timeStr = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      detalle = `📋 *Detalle:*\n• Servicio: ${service?.name}\n• Barbero: ${worker?.name}\n• Fecha: ${dateStr}\n• Hora: ${timeStr}\n• Precio: ${fmt(displayAmount)}`
    }

    const message = `✂️ *¡Hola ${appt.client_name}!*

Tu ${isGroup ? 'reserva' : 'hora'} en *${shop?.name}* está *pendiente de pago*.

${detalle}
${transferBlock}

❌ Para cancelar: ${cancelUrl}

_Te recordaremos 24h y 1h antes de tu cita._`

    await sendWhatsApp(appt.client_phone, message)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('WhatsApp notify error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
