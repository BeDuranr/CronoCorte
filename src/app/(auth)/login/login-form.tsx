'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')

  // Magic link state
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  // Password state
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Reset state
  const [showReset, setShowReset] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Ingresa tu email')
    setMagicLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      setMagicSent(true)
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar el enlace')
    } finally {
      setMagicLoading(false)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return toast.error('Completa email y contraseña')
    setPasswordLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
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
      toast.error(err.message || 'Credenciales incorrectas')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Ingresa tu email')
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success('Te enviamos un link para restablecer tu contraseña')
      setShowReset(false)
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar el email')
    } finally {
      setResetLoading(false)
    }
  }

  // ── Magic link enviado ────────────────────────────────────────────────────
  if (magicSent) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center">
          <Mail size={24} />
        </div>
        <div>
          <p className="font-semibold text-[rgb(var(--fg))]">Revisa tu email</p>
          <p className="text-sm text-[rgb(var(--fg-secondary))] mt-1">
            Enviamos un enlace de acceso a <b>{email}</b>.<br />
            Haz clic en él para entrar — no necesitas contraseña.
          </p>
        </div>
        <button
          onClick={() => { setMagicSent(false); setEmail('') }}
          className="text-xs text-[rgb(var(--fg-secondary))] hover:text-brand-red transition-colors"
        >
          Usar otro email
        </button>
      </div>
    )
  }

  // ── Reset de contraseña ───────────────────────────────────────────────────
  if (showReset) {
    return (
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        <p className="text-sm text-[rgb(var(--fg-secondary))]">
          Ingresa tu email y te enviamos un link para crear una nueva contraseña.
        </p>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <button type="submit" disabled={resetLoading} className="btn-primary flex items-center justify-center gap-2">
          {resetLoading ? <Loader2 size={15} className="animate-spin" /> : 'Enviar link de recuperación'}
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

  // ── Formulario principal ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Email compartido por ambos métodos */}
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          placeholder="tucorreo@mail.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
        />
      </div>

      {/* CTA principal: magic link */}
      <form onSubmit={handleMagicLink}>
        <button
          type="submit"
          disabled={magicLoading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {magicLoading
            ? <Loader2 size={15} className="animate-spin" />
            : <Mail size={15} />}
          Enviarme enlace de acceso
        </button>
      </form>

      {/* Separador */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[rgb(var(--fg-secondary))]/15" />
        <span className="text-xs text-[rgb(var(--fg-secondary))]">o con contraseña</span>
        <div className="flex-1 h-px bg-[rgb(var(--fg-secondary))]/15" />
      </div>

      {/* Método secundario: contraseña */}
      <form onSubmit={handlePassword} className="flex flex-col gap-3">
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="input pr-10 [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
            style={{ WebkitTextSecurity: showPassword ? 'none' : undefined } as any}
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors"
            aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={passwordLoading}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {passwordLoading ? <Loader2 size={15} className="animate-spin" /> : 'Entrar'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => { setShowReset(true) }}
        className="text-xs text-center text-[rgb(var(--fg-secondary))] hover:text-brand-red transition-colors"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </div>
  )
}
