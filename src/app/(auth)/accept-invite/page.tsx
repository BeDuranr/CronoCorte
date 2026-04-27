import { CronoLogo } from '@/components/crono-logo'
import { AcceptInviteForm } from './accept-invite-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Crear contraseña' }

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 bg-[rgb(var(--bg))] pt-20">
      <div className="mb-14 flex justify-center">
        <CronoLogo size="lg" />
      </div>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Crea tu contraseña</h1>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mb-8">
          Bienvenido a CronoCorte. Establece una contraseña para acceder a tu cuenta.
        </p>

        <AcceptInviteForm />
      </div>
    </div>
  )
}
