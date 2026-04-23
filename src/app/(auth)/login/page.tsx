import { LoginForm } from './login-form'
import { CronoLogo } from '@/components/crono-logo'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 bg-[rgb(var(--bg))] pt-20">

      {/* Logo centrado arriba */}
      <div className="mb-14 flex justify-center">
        <CronoLogo size="lg" />
      </div>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-1">Bienvenido de vuelta</h1>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mb-8">
          Ingresa a tu cuenta para gestionar tu barbería.
        </p>

        <LoginForm />

        <p className="mt-6 text-center text-sm text-[rgb(var(--fg-secondary))]">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="text-brand-red hover:text-brand-red-dark font-medium transition-colors">
            Registrar mi barbería
          </a>
        </p>
      </div>
    </div>
  )
}
