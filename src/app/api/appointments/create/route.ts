import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      barbershop_id,
      worker_id,
      service_id,
      client_name,
      client_phone,
      notes,
      starts_at,
      ends_at,
      cancel_token,
    } = body

    if (!barbershop_id || !worker_id || !service_id || !client_name || !client_phone || !starts_at || !ends_at) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verificar que el slot no esté ya ocupado para ese barbero
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('worker_id', worker_id)
      .not('status', 'eq', 'cancelled')
      .lt('starts_at', ends_at)
      .gt('ends_at', starts_at)
      .limit(1)
      .single()

    if (conflict) {
      return NextResponse.json(
        { error: 'Ese horario ya fue reservado. Por favor elige otro.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        barbershop_id,
        worker_id,
        service_id,
        client_name,
        client_phone,
        notes: notes ?? null,
        starts_at,
        ends_at,
        status: 'pending_payment',
        cancel_token,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating appointment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (err: any) {
    console.error('Create appointment error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
