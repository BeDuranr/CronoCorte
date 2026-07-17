import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Creación manual de cita por parte del admin desde el dashboard.
// A diferencia del endpoint público (/api/appointments/create):
//  - Exige sesión de admin dueño de la barbería.
//  - Permite elegir el estado inicial (confirmed por defecto).
//  - No aplica el límite anti-spam por teléfono.
//  - El teléfono es opcional (walk-in sin WhatsApp).
//  - No dispara notificación de WhatsApp.
export async function POST(req: NextRequest) {
  try {
    const {
      barbershop_id,
      worker_id,
      service_id,
      client_name,
      client_phone,
      starts_at,
      ends_at,
      status,
      notes,
    } = await req.json()
    // total_amount se ignora del cliente — se calcula en el servidor.

    // ── Validación de campos ──────────────────────────────────────────
    if (!barbershop_id || !worker_id || !service_id || !client_name?.trim() || !starts_at || !ends_at) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Solo se permiten estos dos estados al crear manualmente.
    const initialStatus: 'confirmed' | 'pending_payment' =
      status === 'pending_payment' ? 'pending_payment' : 'confirmed'

    // ── Verificar sesión de admin ─────────────────────────────────────
    const supabaseUser = await createServerClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // El caller debe ser admin de la barbería indicada.
    const { data: shop } = await supabase
      .from('barbershops')
      .select('id')
      .eq('id', barbershop_id)
      .eq('admin_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
    }

    // ── Validar servicio (pertenece a la barbería) ────────────────────
    const { data: service } = await supabase
      .from('services')
      .select('id, price')
      .eq('id', service_id)
      .eq('barbershop_id', barbershop_id)
      .maybeSingle()

    if (!service) {
      return NextResponse.json({ message: 'Servicio no encontrado' }, { status: 400 })
    }

    // ── Validar barbero (activo en la barbería) ───────────────────────
    const { data: worker } = await supabase
      .from('workers')
      .select('id')
      .eq('id', worker_id)
      .eq('barbershop_id', barbershop_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!worker) {
      return NextResponse.json({ message: 'Barbero no disponible' }, { status: 400 })
    }

    // ── Detección de conflictos (red de seguridad) ────────────────────
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('worker_id', worker_id)
      .not('status', 'eq', 'cancelled')
      .lt('starts_at', ends_at)
      .gt('ends_at', starts_at)
      .limit(1)
      .maybeSingle()

    if (conflict) {
      return NextResponse.json(
        { message: 'Ese horario ya está ocupado. Elige otro.' },
        { status: 409 }
      )
    }

    // ── Insertar ──────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        barbershop_id,
        worker_id,
        service_id,
        client_name: client_name.trim(),
        client_phone: client_phone?.trim() || '',
        notes: notes?.trim() || null,
        starts_at,
        ends_at,
        status: initialStatus,
        cancel_token: crypto.randomUUID().replace(/-/g, ''),
        total_amount: Number(service.price),
      })
      .select('id')
      .single()

    if (error) {
      // Constraint de exclusión: doble reserva concurrente.
      if (error.code === '23P01') {
        return NextResponse.json(
          { message: 'Ese horario ya está ocupado. Elige otro.' },
          { status: 409 }
        )
      }
      console.error('Admin create appointment error:', error)
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id, status: initialStatus })
  } catch (err: any) {
    console.error('Admin create appointment error:', err)
    return NextResponse.json({ message: err.message || 'Error interno' }, { status: 500 })
  }
}
