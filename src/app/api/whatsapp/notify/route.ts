import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM! // 'whatsapp:+56981613286'

// SID de la plantilla de confirmación aprobada por Meta.
// Se lee de variable de entorno para poder cambiarlo sin tocar código.
const TEMPLATE_CONFIRMACION = process.env.TWILIO_TEMPLATE_CONFIRMACION ?? ''

// Envía un mensaje de WhatsApp usando una plantilla aprobada (business-initiated).
// contentVariables es un objeto { "1": "valor", "2": "valor", ... }
async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>
) {
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
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(contentVariables),
    }),
  })

  const data = await res.json()

  console.log('Twilio template response:', JSON.stringify({
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

    if (!TEMPLATE_CONFIRMACION) {
      console.error('Falta TWILIO_TEMPLATE_CONFIRMACION en variables de entorno')
      return NextResponse.json({ message: 'Plantilla no configurada' }, { status: 500 })
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
      timeZone: 'America/Santiago',
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

    // Monto a mostrar: total del grupo si existe, si no el precio del servicio
    const displayAmount = totalAmount ?? service?.price ?? 0

    const isGroup = !!groupId && groupAppts.length > 1

    // ── Construir la variable {{3}} = detalle de servicios/horarios ──
    let detalle: string
    if (isGroup) {
      const lineas = groupAppts.map((a, i) => {
        const t = new Date(a.starts_at).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false })
        const svcName = (a.services as any)?.name ?? 'Servicio'
        const quien = i === 0 ? 'Tú' : `Acompañante ${i}`
        return `${quien}: ${svcName} a las ${t}`
      })
      // En una sola línea separada por " | " para que la plantilla la muestre bien
      detalle = `${lineas.join(' | ')} (${dateStr}, con ${worker?.name})`
    } else {
      const timeStr = date.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false })
      detalle = `${service?.name} el ${dateStr} a las ${timeStr} con ${worker?.name}`
    }

    // Datos de transferencia (variable {{5}}). Si no hay, mensaje genérico.
    const transferInfo = shop?.transfer_info || 'Consulta los datos con la barbería.'

    // ── Variables de la plantilla confirmacion_reserva ──
    // {{1}} nombre, {{2}} barbería, {{3}} detalle, {{4}} total, {{5}} transferencia
    const contentVariables = {
      '1': appt.client_name,
      '2': shop?.name ?? 'la barbería',
      '3': detalle,
      '4': fmt(displayAmount),
      '5': transferInfo,
    }

    await sendWhatsAppTemplate(appt.client_phone, TEMPLATE_CONFIRMACION, contentVariables)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('WhatsApp notify error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
