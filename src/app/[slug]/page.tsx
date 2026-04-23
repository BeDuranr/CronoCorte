import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BookingFlow } from './booking-flow'
import { ChatWidget } from '@/components/chat-widget'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('barbershops')
    .select('name, description')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Barbería no encontrada' }

  return {
    title: `Reservar en ${data.name}`,
    description: data.description ?? `Agenda tu hora en ${data.name}`,
  }
}

export default async function PublicBookingPage({ params }: Props) {
  const supabase = createServerClient()

  const { data: barbershop } = await supabase
    .from('barbershops')
    .select('id, name, slug, description, address, phone, instagram, logo_url, transfer_info, agent_name')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!barbershop) notFound()

  // Active services
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('sort_order')

  // Active workers
  const { data: workers } = await supabase
    .from('workers')
    .select('id, name, specialty, avatar_url')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('name')

  // Availability schedule
  const { data: availability } = await supabase
    .from('availability')
    .select('day_of_week, start_time, end_time')
    .eq('barbershop_id', barbershop.id)
    .eq('is_active', true)
    .order('day_of_week')

  return (
    <>
      <BookingFlow
        barbershop={barbershop as any}
        services={(services as any[]) ?? []}
        workers={(workers as any[]) ?? []}
        availability={(availability as any[]) ?? []}
      />
      <ChatWidget
        barbershopId={barbershop.id}
        barbershopSlug={barbershop.slug}
        agentName={(barbershop as any).agent_name ?? 'Asistente'}
      />
    </>
  )
}
