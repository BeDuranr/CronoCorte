import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!

// SID de las plantillas aprobadas por Meta (en variables de entorno)
const TEMPLATE_RECORDATORIO_24H = process.env.TWILIO_TEMPLATE_RECORDATORIO_24H ?? ''
const TEMPLATE_RECORDATORIO_1H = process.env.TWILIO_TEMPLATE_RECORDATORIO_1H ?? ''

// Envía un mensaje de WhatsApp usando una plantilla aprobada
async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>
): Promise<boolean> {
  if (!contentSid) {
    console.error('ContentSid vacío — plantilla no configurada en env')
    return false
  }
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
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error_code) {
    console.error('Twilio reminder error:', JSON.stringify({
      httpStatus: res.status, errorCode: data.error_code, errorMessage: data.error_message,
    }))
    return false
  }
  return true
}

// Vercel Cron / cron externo: corre cada 30 minutos
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  let sent24h = 0
  let sent1h = 0

  // ─── 24-hour reminders ───────────────────────────────────────────────────────
  const window24hStart = new Date(now)
  window24hStart.setHours(window24hStart.getHours() + 23, window24hStart.getMinutes() + 30)
  const window24hEnd = new Date(now)
  window24hEnd.setHours(window24hEnd.getHours() + 24, window24hEnd.getMinutes() + 30)

  const { data: appts24h } = await supabase
    .from('appointments')
    .select(`
      id, client_name, client_phone, starts_at, cancel_token,
      services(name, price),
      workers(name),
      barbershops(name)
    `)
    .eq('status', 'confirmed')
    .eq('reminder_24h_sent', false)
    .gte('starts_at', window24hStart.toISOString())
    .lte('starts_at', window24hEnd.toISOString())

  const results24h = await Promise.allSettled(
    (appts24h ?? []).map(async appt => {
      const shop = appt.barbershops as any
      const service = appt.services as any
      const date = new Date(appt.starts_at)
      const dateStr = date.toLocaleDateString('es-CL', {
        timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long',
      })
      const timeStr = date.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false })
      const vars = {
        '1': appt.client_name,
        '2': shop?.name ?? 'la barbería',
        '3': dateStr,
        '4': timeStr,
        '5': service?.name ?? 'tu servicio',
      }
      const ok = await sendWhatsAppTemplate(appt.client_phone, TEMPLATE_RECORDATORIO_24H, vars)
      if (ok) {
        await supabase.from('appointments').update({ reminder_24h_sent: true }).eq('id', appt.id)
        return true
      }
      return false
    })
  )
  sent24h = results24h.filter(r => r.status === 'fulfilled' && r.value === true).length

  // ─── 1-hour reminders ────────────────────────────────────────────────────────
  const window1hStart = new Date(now)
  window1hStart.setMinutes(window1hStart.getMinutes() + 30)
  const window1hEnd = new Date(now)
  window1hEnd.setHours(window1hEnd.getHours() + 1, window1hEnd.getMinutes() + 30)

  const { data: appts1h } = await supabase
    .from('appointments')
    .select(`
      id, client_name, client_phone, starts_at, cancel_token,
      services(name),
      workers(name),
      barbershops(name, address)
    `)
    .eq('status', 'confirmed')
    .eq('reminder_1h_sent', false)
    .gte('starts_at', window1hStart.toISOString())
    .lte('starts_at', window1hEnd.toISOString())

  const results1h = await Promise.allSettled(
    (appts1h ?? []).map(async appt => {
      const shop = appt.barbershops as any
      const service = appt.services as any
      const date = new Date(appt.starts_at)
      const timeStr = date.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false })
      const vars = {
        '1': appt.client_name,
        '2': shop?.name ?? 'la barbería',
        '3': timeStr,
        '4': shop?.address || shop?.name || 'la barbería',
      }
      const ok = await sendWhatsAppTemplate(appt.client_phone, TEMPLATE_RECORDATORIO_1H, vars)
      if (ok) {
        await supabase.from('appointments').update({ reminder_1h_sent: true }).eq('id', appt.id)
        return true
      }
      return false
    })
  )
  sent1h = results1h.filter(r => r.status === 'fulfilled' && r.value === true).length

  // ─── Auto-cerrar citas ────────────────────────────────────────────────────────
  // pending_payment con más de 30 min desde creación → cancelled (venció el plazo de pago)
  const paymentDeadline = new Date(now.getTime() - 30 * 60 * 1000)
  const { count: cancelledCount } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('created_at', paymentDeadline.toISOString())

  // confirmed cuya hora ya terminó → completed
  const { count: completedCount } = await supabase
    .from('appointments')
    .update({ status: 'completed' })
    .eq('status', 'confirmed')
    .lt('ends_at', now.toISOString())

  return NextResponse.json({
    ok: true,
    sent24h,
    sent1h,
    autoCancelled: cancelledCount ?? 0,
    autoCompleted: completedCount ?? 0,
    checkedAt: now.toISOString(),
  })
}
