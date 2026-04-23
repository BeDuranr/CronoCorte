import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ message: 'Token requerido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Buscar la cita por cancel_token
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, status, starts_at')
      .eq('cancel_token', token)
      .single()

    if (fetchError || !appt) {
      return NextResponse.json({ message: 'Cita no encontrada' }, { status: 404 })
    }

    if (appt.status === 'cancelled') {
      return NextResponse.json({ message: 'La cita ya fue cancelada' }, { status: 400 })
    }

    if (new Date(appt.starts_at) < new Date()) {
      return NextResponse.json({ message: 'La cita ya pasó y no puede cancelarse' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appt.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Cancel error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
