import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import ical, { ICalCalendarMethod } from 'ical-generator'

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createAdminClient()

    // Find worker by calendar_token
    const { data: worker } = await supabase
      .from('workers')
      .select('id, name, barbershop_id, barbershops(name)')
      .eq('calendar_token', params.token)
      .eq('is_active', true)
      .single()

    if (!worker) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 404 })
    }

    const shop = worker.barbershops as any

    // Get upcoming appointments (next 90 days)
    const now = new Date()
    const future = new Date(now)
    future.setDate(future.getDate() + 90)

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, client_name, starts_at, ends_at, notes, status,
        services(name)
      `)
      .eq('worker_id', worker.id)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', future.toISOString())
      .not('status', 'eq', 'cancelled')
      .order('starts_at', { ascending: true })

    // Build iCal feed
    const cal = ical({
      name: `${worker.name} — ${shop?.name}`,
      description: `Agenda de citas de ${worker.name} en ${shop?.name}`,
      timezone: 'America/Santiago',
      method: ICalCalendarMethod.PUBLISH,
      prodId: { company: 'Crono Corte', product: 'Agenda', language: 'ES' },
    })

    for (const appt of appointments ?? []) {
      const service = appt.services as any
      cal.createEvent({
        id: appt.id,
        start: new Date(appt.starts_at),
        end: new Date(appt.ends_at),
        summary: `${service?.name ?? 'Cita'} — ${appt.client_name}`,
        description: appt.notes ?? undefined,
        location: shop?.name,
      })
    }

    return new NextResponse(cal.toString(), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${worker.name}-agenda.ics"`,
        'Cache-Control': 'no-cache, no-store',
      },
    })
  } catch (err) {
    console.error('iCal error:', err)
    return NextResponse.json({ message: 'Error al generar calendario' }, { status: 500 })
  }
}
