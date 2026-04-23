import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format, parseISO, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { CancelButton } from './cancel-button'
import { CronoLogo } from '@/components/crono-logo'

export default async function CancelarPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()

  const { data: appt } = await supabase
    .from('appointments')
    .select(`
      id, client_name, starts_at, status, cancel_token,
      services(name, price),
      workers(name),
      barbershops(name)
    `)
    .eq('cancel_token', params.token)
    .single()

  if (!appt) notFound()

  const service = appt.services as any
  const worker = appt.workers as any
  const shop = appt.barbershops as any
  const startsAt = parseISO(appt.starts_at)
  const alreadyCancelled = appt.status === 'cancelled'
  const isPast = isBefore(startsAt, new Date())

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10">
          <CronoLogo size="lg" />
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-[rgb(var(--fg))] mb-1">Cancelar cita</h1>
          <p className="text-sm text-[rgb(var(--fg-secondary))] mb-5">
            {shop?.name}
          </p>

          <div className="flex flex-col gap-2 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-secondary))]">Servicio</span>
              <span className="font-medium text-[rgb(var(--fg))]">{service?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-secondary))]">Barbero</span>
              <span className="font-medium text-[rgb(var(--fg))]">{worker?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-secondary))]">Fecha</span>
              <span className="font-medium text-[rgb(var(--fg))]">
                {format(startsAt, "EEEE d 'de' MMMM", { locale: es })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--fg-secondary))]">Hora</span>
              <span className="font-medium text-[rgb(var(--fg))]">
                {format(startsAt, 'HH:mm')}
              </span>
            </div>
          </div>

          {alreadyCancelled ? (
            <div className="bg-[rgb(var(--bg-secondary))] rounded-lg p-4 text-center">
              <p className="text-sm text-[rgb(var(--fg-secondary))]">Esta cita ya fue cancelada.</p>
            </div>
          ) : isPast ? (
            <div className="bg-[rgb(var(--bg-secondary))] rounded-lg p-4 text-center">
              <p className="text-sm text-[rgb(var(--fg-secondary))]">Esta cita ya ha pasado y no puede cancelarse.</p>
            </div>
          ) : (
            <CancelButton cancelToken={params.token} clientName={appt.client_name} />
          )}
        </div>
      </div>
    </div>
  )
}
