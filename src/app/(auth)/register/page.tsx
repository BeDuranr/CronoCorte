import { RegisterForm } from './register-form'
import { CronoLogo } from '@/components/crono-logo'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Registrar barbería' }

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 bg-[rgb(var(--bg))] pt-20">

      {/* Logo centrado arriba */}
      <div className="mb-14 flex justify-center">
        <CronoLogo size="lg" />
      </div>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Registra tu barbería</h1>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mb-8">
          Crea tu cuenta en menos de un minuto. Es gratis.
        </p>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-[rgb(var(--fg-secondary))]">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-brand-red hover:text-brand-red-dark font-medium transition-colors">
            Iniciar sesión
          </a>
        </p>
      </div>
    </div>
  )
}
