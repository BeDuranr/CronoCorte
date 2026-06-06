import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import ical, { ICalCalendarMethod } from 'ical-generator'

// VTIMEZONE para America/Santiago (Chile). Apple Calendar necesita este bloque
// para interpretar correctamente las horas; sin él muestra horas equivocadas.
// Chile: invierno UTC-4 (STANDARD), verano UTC-3 (DAYLIGHT).
const SANTIAGO_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:America/Santiago
BEGIN:STANDARD
DTSTART:20220402T230000
TZOFFSETFROM:-0300
TZOFFSETTO:-0400
TZNAME:-04
RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SA
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20220904T000000
TZOFFSETFROM:-0400
TZOFFSETTO:-0300
TZNAME:-03
RRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=1SU
END:DAYLIGHT
END:VTIMEZONE`

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createAdminClient()

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

    const cal = ical({
      name: `${worker.name} — ${shop?.name}`,
      description: `Agenda de citas de ${worker.name} en ${shop?.name}`,
      timezone: {
        name: 'America/Santiago',
        // Generador que devuelve el VTIMEZONE manual de Chile.
        // ical-generator pasa el nombre de la zona como argumento.
        generator: (_tz: string) => SANTIAGO_VTIMEZONE,
      },
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
