'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DAYS, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Loader2, Plus, Trash2, Check, ChevronRight } from 'lucide-react'
import { CronoLogo } from '@/components/crono-logo'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Service {
  name: string
  duration_minutes: number
  price: number
}

interface DaySchedule {
  enabled: boolean
  start_time: string
  end_time: string
}

type Schedule = Record<string, DaySchedule>

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < current
                ? 'bg-brand-red text-white'
                : i === current
                ? 'border-2 border-brand-red text-brand-red'
                : 'border-2 border-[rgb(var(--fg-secondary))]/30 text-[rgb(var(--fg-secondary))]'
            }`}
          >
            {i < current ? <Check size={12} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-px w-8 transition-all ${
                i < current ? 'bg-brand-red' : 'bg-[rgb(var(--fg-secondary))]/20'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Barbershop profile ───────────────────────────────────────────────
function StepProfile({
  onNext,
  shopId,
}: {
  onNext: () => void
  shopId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    address: '',
    phone: '',
    description: '',
    instagram: '',
    transfer_info: '',
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('barbershops')
        .update({
          address: form.address || null,
          phone: form.phone || null,
          description: form.description || null,
          instagram: form.instagram || null,
          transfer_info: form.transfer_info || null,
        })
        .eq('id', shopId)

      if (error) throw error
      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label">Dirección</label>
        <input
          className="input"
          placeholder="Ej: Av. El Bosque 1234, Santiago"
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
      </div>
      <div>
        <label className="label">Teléfono / WhatsApp</label>
        <input
          className="input"
          placeholder="Ej: +56912345678"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
        />
      </div>
      <div>
        <label className="label">Descripción breve</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Ej: Barbería premium con ambiente relajado..."
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div>
        <label className="label">Instagram (sin @)</label>
        <input
          className="input"
          placeholder="Ej: barberclub"
          value={form.instagram}
          onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
        />
      </div>
      <div>
        <label className="label">Datos de transferencia para pagos</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder={`Banco: Banco Estado\nCuenta RUT: 12.345.678-9\nNombre: Benjamín Durán`}
          value={form.transfer_info}
          onChange={e => setForm(f => ({ ...f, transfer_info: e.target.value }))}
        />
        <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">
          Este texto se enviará al cliente por WhatsApp al confirmar su hora.
        </p>
      </div>
      <button onClick={handleSave} disabled={loading} className="btn-primary mt-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : (
          <span className="flex items-center gap-2">Continuar <ChevronRight size={16} /></span>
        )}
      </button>
    </div>
  )
}

// ─── Step 2: Services ─────────────────────────────────────────────────────────
function StepServices({
  onNext,
  shopId,
}: {
  onNext: () => void
  shopId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([
    { name: 'Corte de pelo', duration_minutes: 30, price: 10000 },
  ])

  const addService = () =>
    setServices(s => [...s, { name: '', duration_minutes: 30, price: 0 }])

  const removeService = (i: number) =>
    setServices(s => s.filter((_, idx) => idx !== i))

  const updateService = (i: number, field: keyof Service, value: string | number) =>
    setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: value } : svc))

  const handleSave = async () => {
    const valid = services.filter(s => s.name.trim())
    if (!valid.length) return toast.error('Agrega al menos un servicio')

    setLoading(true)
    try {
      const rows = valid.map((s, i) => ({
        barbershop_id: shopId,
        name: s.name.trim(),
        duration_minutes: Number(s.duration_minutes),
        price: Number(s.price),
        sort_order: i,
        is_active: true,
      }))

      const { error } = await supabase.from('services').insert(rows)
      if (error) throw error
      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {services.map((svc, i) => (
          <div key={i} className="card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Nombre del servicio"
                value={svc.name}
                onChange={e => updateService(i, 'name', e.target.value)}
              />
              {services.length > 1 && (
                <button
                  onClick={() => removeService(i)}
                  className="p-2 rounded-lg text-[rgb(var(--fg-secondary))] hover:text-brand-red hover:bg-brand-red/10 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Duración (min)</label>
                <select
                  className="input"
                  value={svc.duration_minutes}
                  onChange={e => updateService(i, 'duration_minutes', Number(e.target.value))}
                >
                  {[15, 20, 30, 45, 60, 75, 90, 120].map(m => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Precio (CLP)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="10000"
                  value={svc.price || ''}
                  onChange={e => updateService(i, 'price', Number(e.target.value))}
                />
              </div>
            </div>
            {svc.price > 0 && (
              <p className="text-xs text-[rgb(var(--fg-secondary))]">{formatPrice(svc.price)}</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addService}
        className="btn-secondary flex items-center gap-2 justify-center"
      >
        <Plus size={14} /> Agregar servicio
      </button>

      <button onClick={handleSave} disabled={loading} className="btn-primary mt-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : (
          <span className="flex items-center gap-2">Continuar <ChevronRight size={16} /></span>
        )}
      </button>
    </div>
  )
}

// ─── Step 3: Weekly schedule ──────────────────────────────────────────────────
function StepSchedule({
  onNext,
  shopId,
}: {
  onNext: () => void
  shopId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [schedule, setSchedule] = useState<Schedule>(
    Object.fromEntries(
      DAYS.map(d => [
        d.key,
        {
          enabled: d.index >= 1 && d.index <= 6, // Mon–Sat default
          start_time: '09:00',
          end_time: '20:00',
        },
      ])
    )
  )

  const toggle = (key: string) =>
    setSchedule(s => ({ ...s, [key]: { ...s[key], enabled: !s[key].enabled } }))

  const updateTime = (key: string, field: 'start_time' | 'end_time', val: string) =>
    setSchedule(s => ({ ...s, [key]: { ...s[key], [field]: val } }))

  const handleSave = async () => {
    setLoading(true)
    try {
      const rows = DAYS.filter(d => schedule[d.key].enabled).map(d => ({
        barbershop_id: shopId,
        day_of_week: d.index,
        start_time: schedule[d.key].start_time,
        end_time: schedule[d.key].end_time,
        is_active: true,
      }))

      if (!rows.length) return toast.error('Selecciona al menos un día')

      const { error } = await supabase.from('availability').insert(rows)
      if (error) throw error
      onNext()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {DAYS.map(d => {
        const sch = schedule[d.key]
        return (
          <div
            key={d.key}
            className={`card p-3 transition-all ${
              sch.enabled ? '' : 'opacity-50'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => toggle(d.key)}
                className={`w-10 h-5 rounded-full transition-all relative ${
                  sch.enabled ? 'bg-brand-red' : 'bg-[rgb(var(--fg-secondary))]/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    sch.enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
              <span className="font-medium text-sm w-24">{d.label}</span>
              {sch.enabled && (
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="time"
                    className="input text-sm py-1 px-2 w-24"
                    value={sch.start_time}
                    onChange={e => updateTime(d.key, 'start_time', e.target.value)}
                  />
                  <span className="text-[rgb(var(--fg-secondary))] text-xs">a</span>
                  <input
                    type="time"
                    className="input text-sm py-1 px-2 w-24"
                    value={sch.end_time}
                    onChange={e => updateTime(d.key, 'end_time', e.target.value)}
                  />
                </div>
              )}
              {!sch.enabled && (
                <span className="ml-auto text-xs text-[rgb(var(--fg-secondary))]">Cerrado</span>
              )}
            </div>
          </div>
        )
      })}

      <button onClick={handleSave} disabled={loading} className="btn-primary mt-2">
        {loading ? <Loader2 size={16} className="animate-spin" /> : (
          <span className="flex items-center gap-2">Continuar <ChevronRight size={16} /></span>
        )}
      </button>
    </div>
  )
}

// ─── Step 4: Add workers ──────────────────────────────────────────────────────
function StepWorkers({
  onFinish,
  shopId,
}: {
  onFinish: () => void
  shopId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [workers, setWorkers] = useState([{ name: '', email: '', specialty: '' }])

  const add = () => setWorkers(w => [...w, { name: '', email: '', specialty: '' }])
  const remove = (i: number) => setWorkers(w => w.filter((_, idx) => idx !== i))
  const update = (i: number, field: string, val: string) =>
    setWorkers(w => w.map((wk, idx) => idx === i ? { ...wk, [field]: val } : wk))

  const handleSave = async () => {
    const valid = workers.filter(w => w.name.trim() && w.email.trim())

    setLoading(true)
    try {
      for (const worker of valid) {
        // Invite worker via Supabase Auth (sends magic link to their email)
        const { data: inviteData, error: inviteErr } = await supabase.auth.admin
          ? // admin client not available client-side; use API route instead
          { data: null, error: new Error('use-api') }
          : { data: null, error: new Error('use-api') }

        // Fallback: call our API route to create worker
        const res = await fetch('/api/workers/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: worker.name,
            email: worker.email,
            specialty: worker.specialty,
            barbershop_id: shopId,
          }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.message || 'Error al invitar trabajador')
        }
      }

      toast.success(valid.length ? `${valid.length} barbero(s) invitado(s)` : 'Configuración completada')
      onFinish()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[rgb(var(--fg-secondary))]">
        Invita a tus barberos. Recibirán un email para crear su contraseña y podrán ver su agenda.
      </p>

      <div className="flex flex-col gap-3">
        {workers.map((wk, i) => (
          <div key={i} className="card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Nombre del barbero"
                value={wk.name}
                onChange={e => update(i, 'name', e.target.value)}
              />
              {workers.length > 1 && (
                <button
                  onClick={() => remove(i)}
                  className="p-2 rounded-lg text-[rgb(var(--fg-secondary))] hover:text-brand-red hover:bg-brand-red/10 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input
              type="email"
              className="input"
              placeholder="Email del barbero"
              value={wk.email}
              onChange={e => update(i, 'email', e.target.value)}
            />
            <input
              className="input"
              placeholder="Especialidad (opcional, ej: Degradados, Barba)"
              value={wk.specialty}
              onChange={e => update(i, 'specialty', e.target.value)}
            />
          </div>
        ))}
      </div>

      <button onClick={add} className="btn-secondary flex items-center gap-2 justify-center">
        <Plus size={14} /> Agregar barbero
      </button>

      <div className="flex flex-col gap-2 mt-2">
        <button onClick={handleSave} disabled={loading} className="btn-primary">
          {loading ? <Loader2 size={16} className="animate-spin" /> : (
            workers.some(w => w.name && w.email)
              ? 'Invitar y finalizar'
              : 'Omitir y finalizar'
          )}
        </button>
        <button
          onClick={onFinish}
          className="text-sm text-center text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors py-1"
        >
          Agregar barberos después
        </button>
      </div>
    </div>
  )
}

// ─── Main onboarding page ─────────────────────────────────────────────────────
const STEPS = [
  { title: 'Perfil', subtitle: 'Información de tu barbería' },
  { title: 'Servicios', subtitle: 'Qué ofreces y a qué precio' },
  { title: 'Horario', subtitle: 'Días y horas de atención' },
  { title: 'Equipo', subtitle: 'Agrega a tus barberos' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [shopId, setShopId] = useState<string | null>(null)

  // Load shopId on mount
  useState(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return router.push('/login')
      const { data } = await supabase
        .from('barbershops')
        .select('id')
        .eq('admin_id', user.id)
        .single()
      if (data) setShopId(data.id)
    })
  })

  const next = () => setStep(s => s + 1)
  const finish = () => {
    toast.success('¡Barbería configurada! Bienvenido a Crono Corte.')
    router.push('/dashboard')
  }

  if (!shopId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-red" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] px-4 py-10">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-10">
          <CronoLogo size="lg" />
        </div>

        <StepBar current={step} total={STEPS.length} />

        <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-1">
          {STEPS[step].title}
        </h1>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mb-6">
          {STEPS[step].subtitle}
        </p>

        {step === 0 && <StepProfile onNext={next} shopId={shopId} />}
        {step === 1 && <StepServices onNext={next} shopId={shopId} />}
        {step === 2 && <StepSchedule onNext={next} shopId={shopId} />}
        {step === 3 && <StepWorkers onFinish={finish} shopId={shopId} />}
      </div>
    </div>
  )
}
