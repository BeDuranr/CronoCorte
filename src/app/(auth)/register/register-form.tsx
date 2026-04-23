'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toSlug } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    barbershopName: '',
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName, role: 'admin' }
        },
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      // 2. Crear la barbería
      const slug = toSlug(form.barbershopName)
      const { error: shopError } = await supabase
        .from('barbershops')
        .insert({
          admin_id: authData.user.id,
          name: form.barbershopName,
          slug,
        })
      if (shopError) throw shopError

      toast.success('¡Cuenta creada! Completa el perfil de tu barbería.')
      router.push('/onboarding')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Tu nombre</label>
        <input
          className="input"
          placeholder="Ej: Benjamín Durán"
          value={form.fullName}
          onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="label">Nombre de la barbería</label>
        <input
          className="input"
          placeholder="Ej: Barber Club"
          value={form.barbershopName}
          onChange={e => setForm(f => ({ ...f, barbershopName: e.target.value }))}
          required
        />
        {form.barbershopName && (
          <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">
            URL: cronocorte.app/<strong>{toSlug(form.barbershopName)}</strong>
          </p>
        )}
      </div>
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
            placeholder="Mínimo 8 caracteres"
            minLength={8}
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
      </div>
      <button type="submit" disabled={loading} className="btn-primary mt-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Crear mi cuenta'}
      </button>
    </form>
  )
}
