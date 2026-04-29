import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { CitasView } from './citas-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Todas las citas' }

export default async function CitasPage() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/agenda')

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug')
    .eq('admin_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  // Last 30 days + next 30 days
  const from = new Date()
  from.setDate(from.getDate() - 30)
  const to = new Date()
  to.setDate(to.getDate() + 30)

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, client_name, client_phone, starts_at, ends_at,
      status, payment_verified, notes, created_at,
      services(name, price, duration_minutes),
      workers(name)
    `)
    .eq('barbershop_id', barbershop.id)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at', { ascending: false })

  const { data: workers } = await supabase
    .from('workers')
    .select('id, name')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('name')

  return (
    <>
      <Navbar role="admin" barbershopName={barbershop.name} />
      <CitasView
        barbershopId={barbershop.id}
        appointments={(appointments as any[]) ?? []}
        workers={(workers as any[]) ?? []}
      />
    </>
  )
}
