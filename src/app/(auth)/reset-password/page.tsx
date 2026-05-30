'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CronoLogo } from '@/components/crono-logo'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff, Check } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })

  // Supabase inyecta el token en la URL como hash — esperamos a que la sesión esté lista
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      return toast.error('Las contraseñas no coinciden')
    }
    if (form.password.length < 8) {
      return toast.error('La contraseña debe tener al menos 8 caracteres')
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password })
      if (error) throw error
      setDone(true)
      toast.success('Contraseña actualizada correctamente')
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 bg-[rgb(var(--bg))] pt-20">
      <div className="mb-14 flex justify-center">
        <CronoLogo size="lg" />
      </div>

      <div className="w-full max-w-sm">
        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-2">¡Listo!</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))]">
              Tu contraseña fue actualizada. Redirigiendo al login...
            </p>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-brand-red mx-auto mb-4" />
            <p className="text-sm text-[rgb(var(--fg-secondary))]">
              Verificando el link de recuperación...
            </p>
            <p className="text-xs text-[rgb(var(--fg-secondary))] mt-2 opacity-60">
              Si esto tarda más de unos segundos, el link puede haber expirado.{' '}
              <a href="/login" className="text-brand-red hover:underline">Volver al login</a>
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-1">Nueva contraseña</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))] mb-8">
              Elige una contraseña segura para tu cuenta.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="label">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    autoFocus
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
              </div>
              <div>
                <label className="label">Confirmar contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="Repite tu contraseña"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
