import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM!

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
  return res.ok
}

// Vercel Cron: runs every 30 minutes
// vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "*/30 * * * *" }] }
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

  for (const appt of appts24h ?? []) {
    const shop = appt.barbershops as any
    const service = appt.services as any
    const worker = appt.workers as any
    const date = new Date(appt.starts_at)
    const timeStr = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancelar/${appt.cancel_token}`

    const msg = `⏰ *Recordatorio — mañana tienes hora*

✂️ ${service?.name} con *${worker?.name}*
📍 ${shop?.name}
🕐 ${timeStr}

❌ Si necesitas cancelar: ${cancelUrl}`

    const ok = await sendWhatsApp(appt.client_phone, msg)
    if (ok) {
      await supabase
        .from('appointments')
        .update({ reminder_24h_sent: true })
        .eq('id', appt.id)
      sent24h++
    }
  }

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

  for (const appt of appts1h ?? []) {
    const shop = appt.barbershops as any
    const service = appt.services as any
    const worker = appt.workers as any
    const date = new Date(appt.starts_at)
    const timeStr = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

    const msg = `🔔 *¡Tu hora es en ~1 hora!*

✂️ ${service?.name} con *${worker?.name}* a las *${timeStr}*
${shop?.address ? `📍 ${shop.address}` : `📍 ${shop?.name}`}

¡Te esperamos! ✂️`

    const ok = await sendWhatsApp(appt.client_phone, msg)
    if (ok) {
      await supabase
        .from('appointments')
        .update({ reminder_1h_sent: true })
        .eq('id', appt.id)
      sent1h++
    }
  }

  // ─── Auto-cerrar citas ────────────────────────────────────────────────────────
  // pending_payment con más de 30 min desde creación → cancelled (venció el plazo de pago)
  const paymentDeadline = new Date(now.getTime() - 30 * 60 * 1000)
  const { count: cancelledCount } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('created_at', paymentDeadline.toISOString())

  // confirmed cuya hora ya terminó → completed (asistió y pagó)
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
