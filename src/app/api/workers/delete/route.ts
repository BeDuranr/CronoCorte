import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function createAuthAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { worker_id } = await req.json()
    if (!worker_id) {
      return NextResponse.json({ message: 'worker_id requerido' }, { status: 400 })
    }

    const supabase = createServerClient()
    const admin = createAdminClient()
    const authAdmin = createAuthAdminClient()

    // Verificar que el caller es admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'No autorizado' }, { status: 401 })

    // Obtener el worker y verificar que pertenece a la barbería del admin
    const { data: worker, error: fetchErr } = await admin
      .from('workers')
      .select('id, user_id, barbershop_id')
      .eq('id', worker_id)
      .single()

    if (fetchErr || !worker) {
      return NextResponse.json({ message: 'Barbero no encontrado' }, { status: 404 })
    }

    // Verificar que la barbería pertenece al admin
    const { data: shop } = await supabase
      .from('barbershops')
      .select('id')
      .eq('id', worker.barbershop_id)
      .eq('admin_id', user.id)
      .single()

    if (!shop) return NextResponse.json({ message: 'No autorizado' }, { status: 403 })

    // Eliminar registro del barbero
    const { error: deleteErr } = await admin
      .from('workers')
      .delete()
      .eq('id', worker_id)

    if (deleteErr) throw deleteErr

    // Eliminar cuenta de auth si existe
    if (worker.user_id) {
      await authAdmin.auth.admin.deleteUser(worker.user_id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error deleting worker:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
