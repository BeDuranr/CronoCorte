import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { toSlug } from '@/lib/utils'

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
    const { fullName, barbershopName, email, password } = await req.json()

    if (!fullName?.trim() || !barbershopName?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ message: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const slug = toSlug(barbershopName)
    if (!slug) {
      return NextResponse.json({ message: 'El nombre de la barbería no es válido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const authAdmin = createAuthAdminClient()

    // 1. Verificar que el slug no exista
    const { data: existing } = await admin
      .from('barbershops')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { message: `Ya existe una barbería registrada con el nombre "${barbershopName}". Prueba con un nombre diferente.` },
        { status: 409 }
      )
    }

    // 2. Crear el usuario (email autoconfirmado para que pueda iniciar sesión de inmediato)
    //    El trigger handle_new_user crea el user_profiles con role=admin desde el metadata.
    const { data: created, error: createErr } = await authAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim(), role: 'admin' },
    })

    if (createErr || !created.user) {
      const msg = (createErr?.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json(
          { message: 'Ya existe una cuenta con ese email. Intenta iniciar sesión.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { message: createErr?.message || 'No se pudo crear el usuario' },
        { status: 400 }
      )
    }

    const userId = created.user.id

    // 3. Crear la barbería (bypass RLS con service role)
    const { error: shopErr } = await admin
      .from('barbershops')
      .insert({ admin_id: userId, name: barbershopName.trim(), slug })

    if (shopErr) {
      // Rollback: eliminar el usuario recién creado para no dejarlo huérfano
      await authAdmin.auth.admin.deleteUser(userId)

      if (shopErr.code === '23505') {
        return NextResponse.json(
          { message: `Ya existe una barbería registrada con el nombre "${barbershopName}". Prueba con un nombre diferente.` },
          { status: 409 }
        )
      }
      return NextResponse.json({ message: shopErr.message || 'Error al crear la barbería' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error registrando barbería:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
