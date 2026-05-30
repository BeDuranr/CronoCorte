'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) throw error

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      toast.success('¡Bienvenido!')
      router.push(profile?.role === 'worker' ? '/agenda' : '/dashboard')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success('Te enviamos un email para restablecer tu contraseña.')
      setShowReset(false)
      setResetEmail('')
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar el email')
    } finally {
      setResetLoading(false)
    }
  }

  if (showReset) {
    return (
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-[rgb(var(--fg-secondary))] mb-4">
            Ingresa tu email y te enviaremos un link para crear una nueva contraseña.
          </p>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="tu@email.com"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <button type="submit" disabled={resetLoading} className="btn-primary">
          {resetLoading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar link de recuperación'}
        </button>
        <button
          type="button"
          onClick={() => setShowReset(false)}
          className="text-sm text-center text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors"
        >
          Volver al inicio de sesión
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          placeholder="tu@email.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="label">Contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="input pr-10"
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setShowReset(true); setResetEmail(form.email) }}
          className="text-xs text-[rgb(var(--fg-secondary))] hover:text-brand-red transition-colors mt-1.5 block"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      <button type="submit" disabled={loading} className="btn-primary mt-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Iniciar sesión'}
      </button>
    </form>
  )
}
