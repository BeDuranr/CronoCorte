import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { name, email, specialty, barbershop_id } = await req.json()

    if (!name || !email || !barbershop_id) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = createServerClient()
    const admin = createAdminClient()

    // Verify caller is admin of this barbershop
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'No autorizado' }, { status: 401 })

    const { data: shop } = await supabase
      .from('barbershops')
      .select('id')
      .eq('id', barbershop_id)
      .eq('admin_id', user.id)
      .single()

    if (!shop) return NextResponse.json({ message: 'No autorizado' }, { status: 403 })

    // Try to invite via email (may fail due to rate limits in dev)
    let userId: string | null = null
    try {
      const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, role: 'worker' },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      })
      if (!inviteErr && inviteData?.user) {
        userId = inviteData.user.id
      }
    } catch (_) {
      // Email rate limit or similar — create worker without auth user for now
    }

    // Create worker record
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

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error inviting worker:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
