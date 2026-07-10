import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Cliente admin directo (sin SSR wrapper) — necesario para auth.admin methods
function createAuthAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, specialty, barbershop_id, worker_id } = await req.json()

    if (!name || !email || !barbershop_id) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = createServerClient()
    const admin = createAdminClient()
    const authAdmin = createAuthAdminClient()

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

    // Si viene worker_id → "dar acceso" a un barbero sin cuenta existente.
    // Validamos que exista, pertenezca a la barbería y no tenga ya una cuenta.
    if (worker_id) {
      const { data: existing } = await admin
        .from('workers')
        .select('id, user_id, barbershop_id')
        .eq('id', worker_id)
        .single()

      if (!existing || existing.barbershop_id !== barbershop_id) {
        return NextResponse.json({ message: 'Barbero no encontrado' }, { status: 404 })
      }
      if (existing.user_id) {
        return NextResponse.json({ message: 'Este barbero ya tiene una cuenta' }, { status: 400 })
      }
    }

    // Enviar invitación por email
    const { data: inviteData, error: inviteErr } = await authAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, role: 'worker' },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite`,
    })

    if (inviteErr) {
      console.error('Invite error:', inviteErr)
      return NextResponse.json(
        { message: `Error al enviar invitación: ${inviteErr.message}` },
        { status: 400 }
      )
    }

    const userId = inviteData.user?.id ?? null

    if (worker_id) {
      // Enlazar la cuenta al barbero existente (no crear otro registro)
      const { error: updateErr } = await admin
        .from('workers')
        .update({ user_id: userId, name, specialty: specialty || null })
        .eq('id', worker_id)

      if (updateErr) throw updateErr
    } else {
      // Crear registro del barbero
      const { error: workerErr } = await admin
        .from('workers')
        .insert({
          barbershop_id,
          user_id: userId,
          name,
          specialty: specialty || null,
          is_active: true,
        })

      if (workerErr) throw workerErr
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error inviting worker:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
