import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'

// Crea un barbero SIN cuenta (sin invitación por correo).
// Sirve para el dueño-barbero o para barberos que no necesitan acceso a la app:
// aparecen en la reserva y sus citas se gestionan desde el panel de admin.
export async function POST(req: NextRequest) {
  try {
    const { name, specialty, barbershop_id } = await req.json()

    if (!name?.trim() || !barbershop_id) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = createServerClient()
    const admin = createAdminClient()

    // Verificar que el caller es admin de esta barbería
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'No autorizado' }, { status: 401 })

    const { data: shop } = await supabase
      .from('barbershops')
      .select('id')
      .eq('id', barbershop_id)
      .eq('admin_id', user.id)
      .single()

    if (!shop) return NextResponse.json({ message: 'No autorizado' }, { status: 403 })

    const { error: workerErr } = await admin
      .from('workers')
      .insert({
        barbershop_id,
        user_id: null,
        name: name.trim(),
        specialty: specialty?.trim() || null,
        is_active: true,
      })

    if (workerErr) throw workerErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error creating worker:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
