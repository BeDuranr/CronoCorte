import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
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

    // Verificar que el caller es admin de la barbería a la que pertenece la cita
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('id, status, booking_group_id, barbershop_id')
      .eq('id', id)
      .single()

    if (fetchError || !appt) {
      return NextResponse.json({ message: 'Cita no encontrada' }, { status: 404 })
    }

    const { data: shop } = await supabase
      .from('barbershops')
      .select('id')
      .eq('id', appt.barbershop_id)
      .eq('admin_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
    }

    // Solo se pueden eliminar citas ya canceladas (borrado permanente, sin deshacer).
    if (appt.status !== 'cancelled') {
      return NextResponse.json({ message: 'Solo se pueden eliminar citas canceladas' }, { status: 400 })
    }

    // Si es grupal, eliminar todo el grupo
    if (appt.booking_group_id) {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('booking_group_id', appt.booking_group_id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Admin delete error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
