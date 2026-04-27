'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'

export function AcceptInviteForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [tokenError, setTokenError] = useState(false)

  useEffect(() => {
    // Supabase envía el token en el hash: #access_token=...&refresh_token=...&type=invite
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (type === 'invite' && accessToken && refreshToken) {
      // Establecer sesión con el token de invitación
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setTokenError(true)
          } else {
            setSessionReady(true)
            // Limpiar el hash de la URL sin recargar
            window.history.replaceState(null, '', window.location.pathname)
          }
        })
    } else {
      // No hay token válido — puede que ya haya iniciado sesión o llegó directo
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setSessionReady(true)
        } else {
          setTokenError(true)
        }
      })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('¡Contraseña creada! Redirigiendo...')

      // Obtener rol para redirigir correctamente
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      router.push(profile?.role === 'admin' ? '/dashboard' : '/agenda')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al crear la contraseña')
    } finally {
      setLoading(false)
    }
  }

  if (tokenError) {
    return (
      <div className="card p-5 flex flex-col items-center gap-3 text-center">
        <AlertCircle size={28} className="text-brand-red" />
        <p className="font-semibold text-[rgb(var(--fg))]">Link inválido o expirado</p>
        <p className="text-sm text-[rgb(var(--fg-secondary))]">
          Pide al administrador que te reenvíe la invitación.
        </p>
        <a href="/login" className="text-brand-red text-sm hover:underline">
          Volver al inicio de sesión
        </a>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={24} className="animate-spin text-[rgb(var(--fg-secondary))]" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Nueva contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="input pr-10"
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
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
      </div>

      <div>
        <label className="label">Confirmar contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="input pr-10"
            placeholder="Repite tu contraseña"
            minLength={8}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary mt-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Crear contraseña y entrar'}
      </button>
    </form>
  )
}
