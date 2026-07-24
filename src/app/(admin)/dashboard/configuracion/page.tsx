'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/navbar'
import { DAYS, accentColorVars, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Loader2, Bot, Calendar, Store, Save, CreditCard, Bell, Scissors } from 'lucide-react'

type AgentTone = 'relajado' | 'formal' | 'juvenil'
type CancelPolicy = 'libre' | '2h' | '24h'
type ReminderTiming = '24h' | '2h'

interface ShopConfig {
  id: string
  name: string
  address: string | null
  phone: string | null
  description: string | null
  instagram: string | null
  transfer_info: string | null
  agent_enabled: boolean
  agent_name: string | null
  agent_tone: AgentTone
  agent_prompt_custom: string | null
  accent_color: string
  cancel_policy: CancelPolicy
  reminder_timings: ReminderTiming[]
  whatsapp_template_confirmed: string | null
  whatsapp_template_reminder: string | null
  slot_interval_minutes: number
}

const SLOT_INTERVAL_OPTIONS = [15, 30, 60] as const

interface AvailabilityRow {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  enabled: boolean
}

// Preset colors to choose from
const ACCENT_PRESETS = ['#e63946', '#3563d8', '#3a9b6c', '#8a56c9', '#444444']

// Default WhatsApp templates
const DEFAULT_TEMPLATE_CONFIRMED = `✂️ ¡Hola {{nombre}}! Tu cita está agendada:
📅 {{fecha}} a las {{hora}}
💈 {{servicio}} con {{barbero}}
💰 Total: {{precio}}

{{datos_pago}}

¡Te esperamos!`

const DEFAULT_TEMPLATE_REMINDER = `⏰ Recordatorio: mañana tienes cita a las {{hora}} en {{barberia}}.
✂️ {{servicio}} con {{barbero}}.

¿Algún cambio? Escríbenos.`

export default function ConfiguracionPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [tab, setTab] = useState<'negocio' | 'horario' | 'pagos' | 'agente' | 'notificaciones'>('negocio')
  const [shop, setShop] = useState<ShopConfig | null>(null)
  const [schedule, setSchedule] = useState<AvailabilityRow[]>([])
  const [services, setServices] = useState<{ name: string; price: number }[]>([])

  useEffect(() => { loadData() }, [])

  // Live accent preview
  useEffect(() => {
    if (!shop?.accent_color) return
    const style = document.getElementById('live-accent')
    if (style) style.textContent = `:root { ${accentColorVars(shop.accent_color)} }`
  }, [shop?.accent_color])

  const loadData = async () => {
    try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: shopData, error: shopError } = await supabase
      .from('barbershops')
      .select('id, name, address, phone, description, instagram, transfer_info, agent_enabled, agent_name, agent_tone, agent_prompt_custom, accent_color')
      .eq('admin_id', user.id)
      .single()

    if (shopError || !shopData) {
      setLoading(false)
      return
    }

    // Fetch optional new columns separately so missing columns don't break the whole query
    const { data: extData } = await supabase
      .from('barbershops')
      .select('cancel_policy, reminder_timings, whatsapp_template_confirmed, whatsapp_template_reminder, slot_interval_minutes')
      .eq('id', shopData.id)
      .single()

    setShop({
      ...shopData,
      accent_color: shopData.accent_color ?? '#e63946',
      cancel_policy: (extData as any)?.cancel_policy ?? '2h',
      reminder_timings: (extData as any)?.reminder_timings ?? ['24h'],
      whatsapp_template_confirmed: (extData as any)?.whatsapp_template_confirmed ?? null,
      whatsapp_template_reminder: (extData as any)?.whatsapp_template_reminder ?? null,
      slot_interval_minutes: (extData as any)?.slot_interval_minutes ?? 60,
    } as ShopConfig)

    // Load availability
    const { data: availData } = await supabase
      .from('availability')
      .select('id, day_of_week, start_time, end_time')
      .eq('barbershop_id', shopData?.id)
      .eq('is_active', true)

    const scheduleMap = new Map(availData?.map(a => [a.day_of_week, a]) ?? [])
    const rows: AvailabilityRow[] = DAYS.map(d => ({
      id: scheduleMap.get(d.index)?.id,
      day_of_week: d.index,
      start_time: scheduleMap.get(d.index)?.start_time ?? '09:00',
      end_time: scheduleMap.get(d.index)?.end_time ?? '20:00',
      enabled: scheduleMap.has(d.index),
    }))
    setSchedule(rows)

    // Preview services
    const { data: svcData } = await supabase
      .from('services')
      .select('name, price')
      .eq('barbershop_id', shopData?.id)
      .eq('is_active', true)
      .order('sort_order')
      .limit(4)
    setServices(svcData ?? [])

    } catch (e) {
      console.error('loadData error', e)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    if (!shop) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('barbershops')
        .update({
          address: shop.address,
          phone: shop.phone,
          description: shop.description,
          instagram: shop.instagram,
          accent_color: shop.accent_color,
          cancel_policy: shop.cancel_policy,
        })
        .eq('id', shop.id)
      if (error) throw error
      toast.success('Perfil actualizado')
      router.refresh()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const savePayments = async () => {
    if (!shop) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('barbershops')
        .update({ transfer_info: shop.transfer_info })
        .eq('id', shop.id)
      if (error) throw error
      toast.success('Datos de pago guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const saveAgent = async () => {
    if (!shop) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('barbershops')
        .update({
          agent_enabled: shop.agent_enabled,
          agent_name: shop.agent_name,
          agent_tone: shop.agent_tone,
          agent_prompt_custom: shop.agent_prompt_custom,
        })
        .eq('id', shop.id)
      if (error) throw error
      toast.success('Configuración del agente guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const saveNotifications = async () => {
    if (!shop) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('barbershops')
        .update({
          reminder_timings: shop.reminder_timings,
          whatsapp_template_confirmed: shop.whatsapp_template_confirmed,
          whatsapp_template_reminder: shop.whatsapp_template_reminder,
        })
        .eq('id', shop.id)
      if (error) {
        // Columns may not exist yet in DB
        console.warn('saveNotifications:', error.message)
        toast.error('Estas columnas aún no existen en la BD. Agrega cancel_policy, reminder_timings, whatsapp_template_confirmed y whatsapp_template_reminder a la tabla barbershops.')
      } else {
        toast.success('Notificaciones guardadas')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const saveSchedule = async () => {
    if (!shop) return
    setSavingSchedule(true)
    try {
      await supabase
        .from('barbershops')
        .update({ slot_interval_minutes: shop.slot_interval_minutes })
        .eq('id', shop.id)

      const enabled = schedule.filter(s => s.enabled)
      const disabled = schedule.filter(s => !s.enabled && s.id)

      for (const row of enabled) {
        if (row.id) {
          await supabase
            .from('availability')
            .update({ start_time: row.start_time, end_time: row.end_time })
            .eq('id', row.id)
        } else {
          await supabase
            .from('availability')
            .insert({
              barbershop_id: shop.id,
              day_of_week: row.day_of_week,
              start_time: row.start_time,
              end_time: row.end_time,
              is_active: true,
            })
        }
      }

      for (const row of disabled) {
        await supabase
          .from('availability')
          .update({ is_active: false })
          .eq('id', row.id!)
      }

      toast.success('Horario actualizado')
      loadData()
    } catch {
      toast.error('Error al guardar horario')
    } finally {
      setSavingSchedule(false)
    }
  }

  const updateSchedule = (dayIndex: number, field: keyof AvailabilityRow, value: any) => {
    setSchedule(s => s.map(row => row.day_of_week === dayIndex ? { ...row, [field]: value } : row))
  }

  const toggleReminder = (timing: ReminderTiming) => {
    if (!shop) return
    const current = shop.reminder_timings ?? []
    const next = current.includes(timing)
      ? current.filter(t => t !== timing)
      : [...current, timing]
    setShop(s => s ? { ...s, reminder_timings: next } : s)
  }

  if (loading || !shop) {
    return (
      <>
        <Navbar role="admin" />
        <main className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
          {/* Título */}
          <div className="h-8 w-40 rounded-lg bg-[rgb(var(--fg-secondary))]/15 mb-6" />

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[80, 96, 72, 88, 120].map((w, i) => (
              <div key={i} className={`h-9 rounded-xl bg-[rgb(var(--fg-secondary))]/15`} style={{ width: w }} />
            ))}
          </div>

          {/* Contenido — simula tab "negocio" */}
          <div className="card p-4 flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-3 w-20 rounded bg-[rgb(var(--fg-secondary))]/15" />
                  <div className="h-10 rounded-xl bg-[rgb(var(--fg-secondary))]/10" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-3 w-28 rounded bg-[rgb(var(--fg-secondary))]/15" />
              <div className="h-20 rounded-xl bg-[rgb(var(--fg-secondary))]/10" />
            </div>
            <div className="flex justify-end">
              <div className="h-9 w-24 rounded-xl bg-[rgb(var(--fg-secondary))]/15" />
            </div>
          </div>
        </main>
      </>
    )
  }

  const tabs = [
    { key: 'negocio', label: 'Negocio', icon: Store },
    { key: 'horario', label: 'Horarios', icon: Calendar },
    { key: 'pagos', label: 'Pagos', icon: CreditCard },
    { key: 'agente', label: 'Agente IA', icon: Bot },
    { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
  ] as const

  return (
    <>
      {/* Live accent preview without persisting across navigation */}
      <style id="live-accent">{`:root { ${accentColorVars(shop.accent_color)} }`}</style>
      <Navbar role="admin" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-6">Configuración</h1>

        {/* Tabs — scroll horizontal en mobile */}
        <div className="-mx-4 px-4 overflow-x-auto mb-6">
          <div className="flex gap-2 min-w-max pb-0.5">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all font-medium ${
                tab === key
                  ? 'border-brand-red text-brand-red bg-brand-red/5'
                  : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] hover:border-[rgb(var(--fg-secondary))]/40'
              }`}
            >
              <Icon size={12} /> {label}
              {key === 'notificaciones' && (
                <span className="text-[9px] font-bold text-brand-red border border-brand-red rounded px-1 py-0.5 uppercase tracking-wider ml-0.5">
                  nuevo
                </span>
              )}
            </button>
          ))}
          </div>
        </div>

        {/* ── Negocio ── */}
        {tab === 'negocio' && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6 items-start">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input className="input" value={shop.name} disabled />
                </div>
                <div>
                  <label className="label">Instagram (sin @)</label>
                  <input
                    className="input"
                    value={shop.instagram ?? ''}
                    onChange={e => setShop(s => s ? { ...s, instagram: e.target.value } : s)}
                    placeholder="barberclub"
                  />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    className="input"
                    value={shop.phone ?? ''}
                    onChange={e => setShop(s => s ? { ...s, phone: e.target.value } : s)}
                    placeholder="+56912345678"
                  />
                </div>
                <div>
                  <label className="label">Dirección</label>
                  <input
                    className="input"
                    value={shop.address ?? ''}
                    onChange={e => setShop(s => s ? { ...s, address: e.target.value } : s)}
                    placeholder="Av. El Bosque 1234"
                  />
                </div>
              </div>

              <div>
                <label className="label">Descripción</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={shop.description ?? ''}
                  onChange={e => setShop(s => s ? { ...s, description: e.target.value } : s)}
                />
              </div>

              <div>
                <label className="label">Color de acento</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {ACCENT_PRESETS.map(color => (
                    <button
                      key={color}
                      onClick={() => setShop(s => s ? { ...s, accent_color: color } : s)}
                      style={{ background: color }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        shop.accent_color === color ? 'border-[rgb(var(--fg))] scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={shop.accent_color}
                    onChange={e => setShop(s => s ? { ...s, accent_color: e.target.value } : s)}
                    className="w-7 h-7 rounded-full border border-[rgb(var(--border))] cursor-pointer bg-transparent p-0.5"
                    title="Color personalizado"
                  />
                  <span className="text-xs text-[rgb(var(--fg-secondary))] font-mono">{shop.accent_color}</span>
                </div>
                <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">Vista previa en tiempo real a la derecha.</p>
              </div>

              <div>
                <label className="label">
                  Política de cancelación de clientes
                  <span className="text-[9px] font-bold text-brand-red border border-brand-red rounded px-1 py-0.5 uppercase tracking-wider ml-1.5">
                    nuevo
                  </span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'libre', label: 'Sin restricción' },
                    { key: '2h', label: 'Hasta 2 h antes' },
                    { key: '24h', label: 'Hasta 24 h antes' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setShop(s => s ? { ...s, cancel_policy: key as CancelPolicy } : s)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                        shop.cancel_policy === key
                          ? 'border-brand-red text-brand-red bg-brand-red/5'
                          : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar
                </button>
              </div>
            </div>

            {/* Live preview */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-secondary))] text-center mb-2">
                Vista previa
                <span className="text-[9px] font-bold text-brand-red border border-brand-red rounded px-1 py-0.5 uppercase tracking-wider ml-1">
                  nuevo
                </span>
              </p>
              <div className="border border-[rgb(var(--border))] rounded-2xl overflow-hidden">
                <div className="px-3 py-2.5 border-b border-[rgb(var(--border))] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-xs font-bold">
                    {shop.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--fg))]">{shop.name}</p>
                    {shop.address && <p className="text-[10px] text-[rgb(var(--fg-secondary))]">{shop.address}</p>}
                  </div>
                </div>
                <div className="p-2 flex flex-col gap-1.5">
                  {services.slice(0, 3).map((svc, i) => (
                    <div key={i} className="card flex items-center justify-between p-2 text-[10.5px]">
                      <span>{svc.name}</span>
                      <b>{formatPrice(svc.price)}</b>
                    </div>
                  ))}
                  {services.length === 0 && (
                    <>
                      <div className="card flex items-center justify-between p-2 text-[10.5px]">
                        <span>Corte clásico</span><b>$12.000</b>
                      </div>
                      <div className="card flex items-center justify-between p-2 text-[10.5px]">
                        <span>Barba</span><b>$8.000</b>
                      </div>
                    </>
                  )}
                  <button className="btn-primary text-[10.5px] py-1.5 w-full mt-0.5 flex items-center justify-center gap-1">
                    <Scissors size={10} /> Reservar hora
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Horario ── */}
        {tab === 'horario' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[rgb(var(--fg-secondary))]">Define los días y horas de atención.</p>

            <div className="card p-3">
              <p className="label mb-2">Cada cuánto se ofrece un horario</p>
              <div className="flex gap-2">
                {SLOT_INTERVAL_OPTIONS.map(minutes => (
                  <button
                    key={minutes}
                    onClick={() => setShop(s => s ? { ...s, slot_interval_minutes: minutes } : s)}
                    className={`flex-1 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      shop.slot_interval_minutes === minutes
                        ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
                        : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              <p className="text-xs text-[rgb(var(--fg-secondary))] mt-2">
                Ej: con 30 min, un cliente puede reservar a las 10:00, 10:30, 11:00... En vez de solo en punto.
              </p>
            </div>

            {DAYS.map(day => {
              const row = schedule.find(s => s.day_of_week === day.index)!
              return (
                <div key={day.key} className={`card p-3 transition-all ${!row.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateSchedule(day.index, 'enabled', !row.enabled)}
                      className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${
                        row.enabled ? 'bg-brand-red' : 'bg-[rgb(var(--fg-secondary))]/20'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${row.enabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <span className="font-medium text-sm flex-1">{day.label}</span>
                    {!row.enabled && (
                      <span className="text-xs text-[rgb(var(--fg-secondary))]">Cerrado</span>
                    )}
                  </div>
                  {row.enabled && (
                    <div className="flex items-center gap-2 mt-2 ml-[52px]">
                      <input
                        type="time"
                        className="input text-sm py-1 px-2 flex-1"
                        value={row.start_time}
                        onChange={e => updateSchedule(day.index, 'start_time', e.target.value)}
                      />
                      <span className="text-[10px] text-[rgb(var(--fg-secondary))] shrink-0">a</span>
                      <input
                        type="time"
                        className="input text-sm py-1 px-2 flex-1"
                        value={row.end_time}
                        onChange={e => updateSchedule(day.index, 'end_time', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <button onClick={saveSchedule} disabled={savingSchedule} className="btn-primary flex items-center gap-2 justify-center mt-2">
              {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar horario
            </button>
          </div>
        )}

        {/* ── Pagos ── */}
        {tab === 'pagos' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[rgb(var(--fg-secondary))]">
              Datos que se envían al cliente para pagar por transferencia al reservar.
            </p>
            <div>
              <label className="label">Datos de transferencia</label>
              <textarea
                className="input resize-none font-mono text-sm"
                rows={6}
                value={shop.transfer_info ?? ''}
                onChange={e => setShop(s => s ? { ...s, transfer_info: e.target.value } : s)}
                placeholder={`Banco: Banco Estado\nCuenta RUT: 12.345.678-9\nNombre: Tu Nombre\nMonto: (precio de tu cita)`}
              />
              <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">
                Se incluye en el WhatsApp de confirmación. Escribe uno por línea en formato "Etiqueta: Valor" para habilitar copia individual.
              </p>
            </div>
            <button onClick={savePayments} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </div>
        )}

        {/* ── Agente IA ── */}
        {tab === 'agente' && (
          <div className="flex flex-col gap-4">
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[rgb(var(--fg))]">Agente IA activo</p>
                <p className="text-xs text-[rgb(var(--fg-secondary))] mt-0.5">Muestra el asistente de recomendación de cortes en tu página de reservas</p>
              </div>
              <button
                onClick={() => setShop(s => s ? { ...s, agent_enabled: !s.agent_enabled } : s)}
                className={`w-11 h-6 rounded-full transition-all relative ${shop.agent_enabled ? 'bg-brand-red' : 'bg-[rgb(var(--fg-secondary))]/20'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${shop.agent_enabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            <div>
              <label className="label">Nombre del agente</label>
              <input
                className="input"
                value={shop.agent_name ?? ''}
                onChange={e => setShop(s => s ? { ...s, agent_name: e.target.value } : s)}
                placeholder="Ej: Bruno, Asistente, Bot"
                disabled={!shop.agent_enabled}
              />
            </div>

            <div>
              <label className="label">Tono</label>
              <div className="grid grid-cols-3 gap-2">
                {([['relajado', 'Relajado'], ['formal', 'Formal'], ['juvenil', 'Juvenil']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setShop(s => s ? { ...s, agent_tone: key } : s)}
                    disabled={!shop.agent_enabled}
                    className={`py-2 text-sm rounded-lg border transition-all disabled:opacity-40 ${
                      shop.agent_tone === key
                        ? 'border-brand-red bg-brand-red/5 text-brand-red'
                        : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Instrucciones personalizadas (opcional)</label>
              <textarea
                className="input resize-none font-mono text-xs"
                rows={6}
                value={shop.agent_prompt_custom ?? ''}
                onChange={e => setShop(s => s ? { ...s, agent_prompt_custom: e.target.value } : s)}
                placeholder="Deja vacío para usar el prompt optimizado según el tono elegido..."
                disabled={!shop.agent_enabled}
              />
            </div>

            <button onClick={saveAgent} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar configuración
            </button>
          </div>
        )}

        {/* ── Notificaciones ── */}
        {tab === 'notificaciones' && (
          <div className="flex flex-col gap-5">
            <div className="card p-4 flex flex-col gap-3">
              <p className="font-semibold text-sm text-[rgb(var(--fg))]">Recordatorios automáticos</p>
              <p className="text-xs text-[rgb(var(--fg-secondary))]">
                Se envían por WhatsApp antes de cada cita confirmada.
              </p>
              <div className="flex gap-2 flex-wrap">
                {([['24h', '24 horas antes'], ['2h', '2 horas antes']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleReminder(key)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                      shop.reminder_timings?.includes(key)
                        ? 'border-brand-red text-brand-red bg-brand-red/5'
                        : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Plantilla — confirmación de reserva</label>
                <span className="text-[10px] text-[rgb(var(--fg-secondary))] border border-[rgb(var(--fg-secondary))]/20 rounded px-1.5 py-0.5">Solo lectura</span>
              </div>
              <pre className="input resize-none font-mono text-xs whitespace-pre-wrap bg-[rgb(var(--bg-secondary))] opacity-75 cursor-default select-text">{shop.whatsapp_template_confirmed ?? DEFAULT_TEMPLATE_CONFIRMED}</pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Plantilla — recordatorio</label>
                <span className="text-[10px] text-[rgb(var(--fg-secondary))] border border-[rgb(var(--fg-secondary))]/20 rounded px-1.5 py-0.5">Solo lectura</span>
              </div>
              <pre className="input resize-none font-mono text-xs whitespace-pre-wrap bg-[rgb(var(--bg-secondary))] opacity-75 cursor-default select-text">{shop.whatsapp_template_reminder ?? DEFAULT_TEMPLATE_REMINDER}</pre>
            </div>

            <p className="text-xs text-[rgb(var(--fg-secondary))] bg-[rgb(var(--bg-secondary))] rounded-xl px-4 py-3">
              Las plantillas de WhatsApp requieren aprobación de Twilio. Para modificarlas, contacta al equipo de CronoCorte.
            </p>

            <button onClick={saveNotifications} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar recordatorios
            </button>
          </div>
        )}
      </main>
    </>
  )
}
