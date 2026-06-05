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
      .select('id, name, barbershop_id, barbershops(name, address)')
      .eq('calendar_token', params.token)
      .eq('is_active', true)
      .single()

    if (!worker) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 404 })
    }

    const shop = worker.barbershops as any

    // Get upcoming appointments (next 90 days) + past 7 days (para ver las recientes)
    const past = new Date()
    past.setDate(past.getDate() - 7)
    const future = new Date()
    future.setDate(future.getDate() + 90)

    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, client_name, starts_at, ends_at, notes, status,
        services(name)
      `)
      .eq('worker_id', worker.id)
      .gte('starts_at', past.toISOString())
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
      const statusLabel = appt.status === 'confirmed' ? '✅'
        : appt.status === 'pending_payment' ? '⏳'
        : appt.status === 'completed' ? '✔️' : ''

      cal.createEvent({
        id: appt.id,
        start: new Date(appt.starts_at),
        end: new Date(appt.ends_at),
        timezone: 'America/Santiago',
        summary: `${statusLabel} ${service?.name ?? 'Cita'} — ${appt.client_name}`,
        description: [
          `Cliente: ${appt.client_name}`,
          `Servicio: ${service?.name ?? 'N/A'}`,
          `Estado: ${appt.status}`,
          appt.notes ? `Notas: ${appt.notes}` : '',
        ].filter(Boolean).join('\n'),
        location: shop?.address || shop?.name,
      })
    }

    return new NextResponse(cal.toString(), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${worker.name}-agenda.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    console.error('iCal error:', err)
    return NextResponse.json({ message: 'Error al generar calendario' }, { status: 500 })
  }
}
