import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format, parseISO, isBefore, differenceInHours } from 'date-fns'
import { es } from 'date-fns/locale'
import { CancelActions } from './cancel-button'
import { CronoLogo } from '@/components/crono-logo'

export default async function CancelarPage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient()

  const { data: appt } = await supabase
    .from('appointments')
    .select(`
      id, client_name, starts_at, status, cancel_token,
      services(name, price),
      workers(name),
      barbershops(id, name, slug, cancel_policy)
    `)
    .eq('cancel_token', params.token)
    .single()

  if (!appt) notFound()

  const service = appt.services as any
  const worker = appt.workers as any
  const shop = appt.barbershops as any
  const startsAt = parseISO(appt.starts_at)
  const now = new Date()

  const alreadyCancelled = appt.status === 'cancelled'
  const isPast = isBefore(startsAt, now)

  // Check cancellation policy
  const cancelPolicy: string = shop?.cancel_policy ?? '2h'
  const hoursUntil = differenceInHours(startsAt, now)
  const policyBlocked =
    cancelPolicy === '2h' ? hoursUntil < 2 :
    cancelPolicy === '24h' ? hoursUntil < 24 :
    false // 'libre' = always allowed

  const policyLabel =
    cancelPolicy === '2h' ? 'Puedes cambiar o cancelar hasta 2 horas antes.' :
    cancelPolicy === '24h' ? 'Puedes cambiar o cancelar hasta 24 horas antes.' :
    'Puedes cambiar o cancelar en cualquier momento.'

  // Status display
  const statusLabel: Record<string, string> = {
    pending_payment: 'Pendiente de pago',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
  }
  const statusColor: Record<string, string> = {
    pending_payment: 'text-yellow-500',
    confirmed: 'text-green-500',
    completed: 'text-[rgb(var(--fg-secondary))]',
    cancelled: 'text-brand-red',
  }

  const rescheduleUrl = shop?.slug ? `/${shop.slug}` : '/'

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <CronoLogo size="lg" />
        </div>

        <div className="card p-5 mb-4">
          {/* Shop & Status header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-[rgb(var(--fg-secondary))]">{shop?.name}</p>
              <h1 className="text-lg font-bold text-[rgb(var(--fg))] mt-0.5">Tu cita</h1>
            </div>
            <span className={`text-xs font-semibold ${statusColor[appt.status] ?? 'text-[rgb(var(--fg-secondary))]'} flex items-center gap-1`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusLabel[appt.status] ?? appt.status}
            </span>
          </div>

          {/* Appointment details */}
          <div className="border border-[rgb(var(--border))] rounded-xl overflow-hidden mb-5">
            {[
              { label: 'Servicio', value: service?.name },
              { label: 'Barbero', value: worker?.name },
              {
                label: 'Fecha',
                value: format(startsAt, "EEEE d 'de' MMMM", { locale: es }),
              },
              { label: 'Hora', value: format(startsAt, 'HH:mm') },
            ].map(({ label, value }, i, arr) => (
              <div
                key={label}
                className={`flex justify-between text-sm px-4 py-3 ${i < arr.length - 1 ? 'border-b border-[rgb(var(--border))]' : ''}`}
              >
                <span className="text-[rgb(var(--fg-secondary))]">{label}</span>
                <span className="font-medium text-[rgb(var(--fg))] capitalize">{value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          {alreadyCancelled ? (
            <div className="flex flex-col gap-3 text-center">
              <div className="bg-[rgb(var(--bg-secondary))] rounded-xl p-4">
                <p className="text-sm text-[rgb(var(--fg-secondary))]">Esta cita ya fue cancelada.</p>
              </div>
              <a href={rescheduleUrl} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                Reservar nueva hora
              </a>
            </div>
          ) : isPast ? (
            <div className="bg-[rgb(var(--bg-secondary))] rounded-xl p-4 text-center">
              <p className="text-sm text-[rgb(var(--fg-secondary))]">Esta cita ya ha pasado.</p>
            </div>
          ) : policyBlocked ? (
            <div className="bg-[rgb(var(--bg-secondary))] rounded-xl p-4 text-center">
              <p className="text-sm text-[rgb(var(--fg-secondary))]">
                El plazo para cancelar o reprogramar ha expirado.<br />
                <span className="text-xs">{policyLabel}</span>
              </p>
            </div>
          ) : (
            <CancelActions
              cancelToken={params.token}
              rescheduleUrl={rescheduleUrl}
              clientName={appt.client_name}
            />
          )}
        </div>

        {/* Policy & refund footer */}
        {!alreadyCancelled && !isPast && (
          <p className="text-center text-xs text-[rgb(var(--fg-secondary))] leading-relaxed px-2">
            {policyLabel}
            {service?.price > 0 && ' Si pagaste, la barbería coordinará tu reembolso por WhatsApp.'}
          </p>
        )}
      </div>
    </div>
  )
}
