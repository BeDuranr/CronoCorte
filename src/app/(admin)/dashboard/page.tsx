import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { DashboardView } from './dashboard-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/agenda')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, transfer_info, agent_enabled, agent_name, agent_tone')
    .eq('admin_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  // Today's appointments
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: todayAppointments } = await supabase
    .from('appointments')
    .select(`
      id, client_name, starts_at, ends_at, status, payment_verified,
      services(name, price, duration_minutes),
      workers(name)
    `)
    .eq('barbershop_id', barbershop.id)
    .gte('starts_at', `${todayStr}T00:00:00`)
    .lte('starts_at', `${todayStr}T23:59:59`)
    .not('status', 'eq', 'cancelled')
    .order('starts_at', { ascending: true })

  // This week stats
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1) // Monday
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const { data: weekAppointments } = await supabase
    .from('appointments')
    .select('id, starts_at, status, services(price)')
    .eq('barbershop_id', barbershop.id)
    .gte('starts_at', weekStart.toISOString())
    .lte('starts_at', weekEnd.toISOString())
    .not('status', 'eq', 'cancelled')

  const weekRevenue = weekAppointments
    ?.filter(a => a.status === 'confirmed' || a.status === 'completed')
    .reduce((sum, a) => sum + ((a.services as any)?.price || 0), 0) ?? 0

  // Workers
  const { data: workers } = await supabase
    .from('workers')
    .select('id, name, specialty, is_active')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('name')

  return (
    <>
      <Navbar role="admin" barbershopName={barbershop.name} />
      <DashboardView
        barbershop={barbershop}
        todayAppointments={(todayAppointments as any[]) ?? []}
        weekStats={{
          totalAppointments: weekAppointments?.length ?? 0,
          revenue: weekRevenue,
          completedToday: todayAppointments?.filter(a => a.status === 'completed').length ?? 0,
        }}
        workers={(workers as any[]) ?? []}
        adminName={profile?.full_name ?? ''}
      />
    </>
  )
}
