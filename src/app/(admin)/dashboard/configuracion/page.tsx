'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/navbar'
import { DAYS } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Loader2, Bot, Calendar, Store, Save } from 'lucide-react'

type AgentTone = 'relajado' | 'formal' | 'juvenil'

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
}

interface AvailabilityRow {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  enabled: boolean
}

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [tab, setTab] = useState<'perfil' | 'agente' | 'horario'>('perfil')
  const [shop, setShop] = useState<ShopConfig | null>(null)
  const [schedule, setSchedule] = useState<AvailabilityRow[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shopData } = await supabase
      .from('barbershops')
      .select('id, name, address, phone, description, instagram, transfer_info, agent_enabled, agent_name, agent_tone, agent_prompt_custom')
      .eq('admin_id', user.id)
      .single()

    if (shopData) setShop(shopData as ShopConfig)

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
    setLoading(false)
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
          transfer_info: shop.transfer_info,
        })
        .eq('id', shop.id)
      if (error) throw error
      toast.success('Perfil actualizado')
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

  const saveSchedule = async () => {
    if (!shop) return
    setSavingSchedule(true)
    try {
      const enabled = schedule.filter(s => s.enabled)
      const disabled = schedule.filter(s => !s.enabled && s.id)

      // Upsert enabled days
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

      // Deactivate disabled days
      for (const row of disabled) {
        await supabase
          .from('availability')
          .update({ is_active: false })
          .eq('id', row.id!)
      }

      toast.success('Horario actualizado')
      loadData() // Refresh to get new IDs
    } catch {
      toast.error('Error al guardar horario')
    } finally {
      setSavingSchedule(false)
    }
  }

  const updateSchedule = (dayIndex: number, field: keyof AvailabilityRow, value: any) => {
    setSchedule(s => s.map(row => row.day_of_week === dayIndex ? { ...row, [field]: value } : row))
  }

  if (loading || !shop) {
    return (
      <>
        <Navbar role="admin" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-brand-red" size={24} />
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar role="admin" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--fg))] mb-6">Configuración</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[rgb(var(--bg-secondary))] p-1 rounded-xl">
          {[
            { key: 'perfil', label: 'Perfil', icon: Store },
            { key: 'agente', label: 'Agente IA', icon: Bot },
            { key: 'horario', label: 'Horario', icon: Calendar },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === key
                  ? 'bg-[rgb(var(--bg))] text-[rgb(var(--fg))] shadow-sm'
                  : 'text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))]'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Perfil tab */}
        {tab === 'perfil' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Nombre de la barbería</label>
              <input className="input" value={shop.name} disabled />
            </div>
            <div>
              <label className="label">Dirección</label>
              <input
                className="input"
                value={shop.address ?? ''}
                onChange={e => setShop(s => s ? { ...s, address: e.target.value } : s)}
                placeholder="Av. El Bosque 1234, Santiago"
              />
            </div>
            <div>
              <label className="label">Teléfono / WhatsApp</label>
              <input
                className="input"
                value={shop.phone ?? ''}
                onChange={e => setShop(s => s ? { ...s, phone: e.target.value } : s)}
                placeholder="+56912345678"
              />
            </div>
            <div>
              <label className="label">Descripción</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={shop.description ?? ''}
                onChange={e => setShop(s => s ? { ...s, description: e.target.value } : s)}
              />
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
              <label className="label">Datos de transferencia</label>
              <textarea
                className="input resize-none"
                rows={4}
                value={shop.transfer_info ?? ''}
                onChange={e => setShop(s => s ? { ...s, transfer_info: e.target.value } : s)}
                placeholder={`Banco: Banco Estado\nCuenta RUT: 12.345.678-9\nNombre: Tu Nombre`}
              />
              <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">
                Se incluye en el WhatsApp de confirmación de reserva.
              </p>
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center gap-2 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar cambios
            </button>
          </div>
        )}

        {/* Agente IA tab */}
        {tab === 'agente' && (
          <div className="flex flex-col gap-4">
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[rgb(var(--fg))]">Agente IA activo</p>
                <p className="text-xs text-[rgb(var(--fg-secondary))] mt-0.5">
                  Responde automáticamente mensajes de WhatsApp
                </p>
              </div>
              <button
                onClick={() => setShop(s => s ? { ...s, agent_enabled: !s.agent_enabled } : s)}
                className={`w-11 h-6 rounded-full transition-all relative ${
                  shop.agent_enabled ? 'bg-brand-red' : 'bg-[rgb(var(--fg-secondary))]/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    shop.agent_enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
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
                {[
                  { key: 'relajado', label: 'Relajado' },
                  { key: 'formal', label: 'Formal' },
                  { key: 'juvenil', label: 'Juvenil' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setShop(s => s ? { ...s, agent_tone: key as AgentTone } : s)}
                    disabled={!shop.agent_enabled}
                    className={`py-2 text-sm rounded-lg border transition-all ${
                      shop.agent_tone === key
                        ? 'border-brand-red bg-brand-red/5 text-brand-red'
                        : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                    } disabled:opacity-40`}
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
                placeholder="Deja vacío para usar el prompt por defecto. Puedes personalizar el comportamiento del agente aquí..."
                disabled={!shop.agent_enabled}
              />
              <p className="text-xs text-[rgb(var(--fg-secondary))] mt-1">
                Si lo dejas vacío, el agente usará un prompt optimizado automáticamente según el tono que elegiste.
              </p>
            </div>

            <button onClick={saveAgent} disabled={saving} className="btn-primary flex items-center gap-2 justify-center">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar configuración
            </button>
          </div>
        )}

        {/* Horario tab */}
        {tab === 'horario' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[rgb(var(--fg-secondary))]">
              Define los días y horas de atención de tu barbería.
            </p>
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
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          row.enabled ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <span className="font-medium text-sm w-24">{day.label}</span>
                    {row.enabled ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          className="input text-sm py-1 px-2 w-24"
                          value={row.start_time}
                          onChange={e => updateSchedule(day.index, 'start_time', e.target.value)}
                        />
                        <span className="text-xs text-[rgb(var(--fg-secondary))]">a</span>
                        <input
                          type="time"
                          className="input text-sm py-1 px-2 w-24"
                          value={row.end_time}
                          onChange={e => updateSchedule(day.index, 'end_time', e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-xs text-[rgb(var(--fg-secondary))]">Cerrado</span>
                    )}
                  </div>
                </div>
              )
            })}
            <button onClick={saveSchedule} disabled={savingSchedule} className="btn-primary flex items-center gap-2 justify-center mt-2">
              {savingSchedule ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar horario
            </button>
          </div>
        )}
      </main>
    </>
  )
}
