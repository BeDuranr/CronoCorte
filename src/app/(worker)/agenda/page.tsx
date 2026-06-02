import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { AgendaView } from './agenda-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mi Agenda' }

export default async function AgendaPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'worker') redirect('/dashboard')

  // Get worker record
  const { data: worker } = await supabase
    .from('workers')
    .select('id, name, specialty, barbershop_id, calendar_token, barbershops(name, slug)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[rgb(var(--fg-secondary))]">Tu cuenta de barbero no está activa.</p>
          <p className="text-sm text-[rgb(var(--fg-secondary))]/60 mt-1">Contacta al administrador.</p>
        </div>
      </div>
    )
  }

  // Today's appointments for this worker
  // Fecha "hoy" en zona Chile (en-CA da formato YYYY-MM-DD)
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  // Rango ampliado +/-1 dia (las citas se guardan en UTC); luego filtramos por dia Chile
  const prevStr = new Date(today.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const nextStr = new Date(today.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

  const { data: todayApptsRaw } = await supabase
    .from('appointments')
    .select(`
      id, client_name, client_phone, starts_at, ends_at, status, notes, recommended_style,
      services(name, price, duration_minutes)
    `)
    .eq('worker_id', worker.id)
    .gte('starts_at', `${prevStr}T00:00:00`)
    .lte('starts_at', `${nextStr}T23:59:59`)
    .not('status', 'eq', 'cancelled')
    .order('starts_at', { ascending: true })

  const todayAppts = (todayApptsRaw ?? []).filter(
    a => new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) === todayStr
  )

  // This week's stats
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const { data: weekAppts } = await supabase
    .from('appointments')
    .select('id, status, services(price)')
    .eq('worker_id', worker.id)
    .gte('starts_at', weekStart.toISOString())
    .lte('starts_at', weekEnd.toISOString())
    .not('status', 'eq', 'cancelled')

  const weekRevenue = weekAppts?.reduce(
    (sum, a) => sum + ((a.services as any)?.price ?? 0),
    0
  ) ?? 0

  const barbershop = worker.barbershops as any

  return (
    <>
      <Navbar role="worker" barbershopName={barbershop?.name} />
      <AgendaView
        worker={{ ...worker, barbershop } as any}
        todayAppointments={(todayAppts as any[]) ?? []}
        weekStats={{
          total: weekAppts?.length ?? 0,
          completed: weekAppts?.filter(a => a.status === 'completed').length ?? 0,
          revenue: weekRevenue,
        }}
      />
    </>
  )
}
