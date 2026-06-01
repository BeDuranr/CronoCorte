import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Un "bloque" representa a una persona dentro de la reserva.
interface BookingBlock {
  service_id: string
  starts_at: string
  ends_at: string
  person_name?: string // nombre opcional del acompañante; si no, se deriva del titular
  notes?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      barbershop_id,
      worker_id,
      client_name,
      client_phone,
      cancel_token,
      // Formato nuevo (grupal):
      blocks,
      total_amount,
      // Formato antiguo (una sola cita) — compatibilidad hacia atrás:
      service_id,
      starts_at,
      ends_at,
      notes,
    } = body

    // ── Normalizar a un array de bloques ──────────────────────────────
    // Si viene `blocks` usamos ese; si no, construimos uno desde los campos sueltos.
    let normalizedBlocks: BookingBlock[]

    if (Array.isArray(blocks) && blocks.length > 0) {
      normalizedBlocks = blocks
    } else if (service_id && starts_at && ends_at) {
      normalizedBlocks = [{ service_id, starts_at, ends_at, notes: notes ?? null }]
    } else {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (!barbershop_id || !worker_id || !client_name || !client_phone) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Validar que cada bloque tenga sus campos
    for (const b of normalizedBlocks) {
      if (!b.service_id || !b.starts_at || !b.ends_at) {
        return NextResponse.json(
          { error: 'Cada bloque necesita servicio, inicio y fin' },
          { status: 400 }
        )
      }
    }

    const supabase = createAdminClient()

    // ── Validar que ningún bloque choque con citas existentes ─────────
    for (const b of normalizedBlocks) {
      const { data: conflict } = await supabase
        .from('appointments')
        .select('id')
        .eq('worker_id', worker_id)
        .not('status', 'eq', 'cancelled')
        .lt('starts_at', b.ends_at)
        .gt('ends_at', b.starts_at)
        .limit(1)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json(
          { error: 'Uno de los horarios ya fue reservado. Por favor elige otro.' },
          { status: 409 }
        )
      }
    }

    // ── Validar que los bloques entre sí no se solapen ────────────────
    const sorted = [...normalizedBlocks].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )
    for (let i = 1; i < sorted.length; i++) {
      if (new Date(sorted[i].starts_at) < new Date(sorted[i - 1].ends_at)) {
        return NextResponse.json(
          { error: 'Los horarios seleccionados se solapan entre sí.' },
          { status: 409 }
        )
      }
    }

    // ── Datos compartidos del grupo ───────────────────────────────────
    const isGroup = normalizedBlocks.length > 1
    const groupId = isGroup ? crypto.randomUUID() : null
    const sharedToken = cancel_token ?? crypto.randomUUID().replace(/-/g, '')

    // ── Construir las filas a insertar ────────────────────────────────
    const rows = normalizedBlocks.map((b, idx) => ({
      barbershop_id,
      worker_id,
      service_id: b.service_id,
      client_name:
        idx === 0
          ? client_name
          : b.person_name?.trim() || `Acompañante de ${client_name}`,
      client_phone,
      notes: b.notes ?? null,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: 'pending_payment' as const,
      cancel_token: idx === 0 ? sharedToken : `${sharedToken}-${idx}`,
      booking_group_id: groupId,
      total_amount: total_amount ?? null,
    }))

    const { data, error } = await supabase
      .from('appointments')
      .insert(rows)
      .select('id, starts_at')

    if (error) {
      console.error('Error creating appointment(s):', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // La cita "principal" es la del primer bloque (la que dispara la notificación).
    const primary = data[0]

    return NextResponse.json({
      id: primary.id,
      booking_group_id: groupId,
      cancel_token: sharedToken,
      count: data.length,
    })
  } catch (err: any) {
    console.error('Create appointment error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
