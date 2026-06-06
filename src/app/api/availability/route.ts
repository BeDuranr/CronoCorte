import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Endpoint público: devuelve SOLO los rangos horarios ocupados de un barbero
// en una fecha (sin nombres, teléfonos ni datos personales). Usado por la
// página de reservas para calcular slots disponibles sin exponer las citas
// vía RLS al cliente anónimo.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workerId = searchParams.get('worker_id')
    const date = searchParams.get('date') // YYYY-MM-DD

    if (!workerId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Rango ampliado +/-1 dia para cubrir el desfase UTC/Chile
    const d = new Date(date + 'T12:00:00')
    const prev = new Date(d); prev.setDate(prev.getDate() - 1)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const prevStr = prev.toISOString().slice(0, 10)
    const nextStr = next.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('worker_id', workerId)
      .gte('starts_at', `${prevStr}T00:00:00`)
      .lte('starts_at', `${nextStr}T23:59:59`)
      .not('status', 'eq', 'cancelled')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Devolver SOLO los rangos (sin ningún dato personal)
    const occupied = (data ?? []).map(a => ({ starts_at: a.starts_at, ends_at: a.ends_at }))

    return NextResponse.json({ occupied })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 })
  }
}
