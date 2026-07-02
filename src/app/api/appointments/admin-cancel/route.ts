import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { id, reason } = await req.json()
    if (!id) {
      return NextResponse.json({ message: 'id requerido' }, { status: 400 })
    }

    // Verificar que el solicitante es admin autenticado
    const supabaseUser = await createServerClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verificar que la cita pertenece a la barbería del admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
    }

    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, status, booking_group_id, barbershop_id')
      .eq('id', id)
      .single()

    if (fetchError || !appt) {
      return NextResponse.json({ message: 'Cita no encontrada' }, { status: 404 })
    }

    if (appt.barbershop_id !== profile.barbershop_id) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
    }

    if (appt.status === 'cancelled') {
      return NextResponse.json({ message: 'La cita ya fue cancelada' }, { status: 400 })
    }

    // Si es grupal, cancelar todo el grupo
    if (appt.booking_group_id) {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled', cancellation_reason: reason ?? null })
        .eq('booking_group_id', appt.booking_group_id)
        .not('status', 'eq', 'cancelled')
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled', cancellation_reason: reason ?? null })
        .eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Admin cancel error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
