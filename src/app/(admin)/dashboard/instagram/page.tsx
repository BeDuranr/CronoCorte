import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { InstagramView } from './instagram-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Historia para Instagram' }

export default async function InstagramStoryPage() {
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
    .select('id, name, slug, accent_color, instagram, logo_url, slot_interval_minutes')
    .eq('admin_id', user.id)
    .single()

  if (!barbershop) redirect('/onboarding')

  const { data: workers } = await supabase
    .from('workers')
    .select('id, name')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('name')

  // Disponibilidad semanal a nivel de barbería, igual que la página pública.
  const { data: availability } = await supabase
    .from('availability')
    .select('day_of_week, start_time, end_time')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('day_of_week')

  return (
    <>
      <Navbar role="admin" barbershopName={barbershop.name} />
      <InstagramView
        barbershop={barbershop as any}
        workers={(workers as any[]) ?? []}
        availability={(availability as any[]) ?? []}
      />
    </>
  )
}
