'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/navbar'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Trash2, GripVertical, Pencil, Check, X, Loader2 } from 'lucide-react'

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
  is_active: boolean
  sort_order: number
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${on ? 'bg-brand-red' : 'bg-[rgb(var(--fg-secondary))]/20'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  )
}

// ── Preset chips de duración ──────────────────────────────────────────────────
const DURATION_PRESETS = [20, 30, 45, 60, 75, 90]

function DurationPresets({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DURATION_PRESETS.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
            value === m
              ? 'border-brand-red text-brand-red bg-brand-red/5 font-semibold'
              : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] hover:border-[rgb(var(--fg-secondary))]/40'
          }`}
        >
          {m} min
        </button>
      ))}
    </div>
  )
}

// ── Fila de servicio ──────────────────────────────────────────────────────────
function ServiceRow({
  svc,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  svc: Service
  onUpdate: (id: string, data: Partial<Service>) => void
  onDelete: (id: string) => void
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: svc.name,
    duration_minutes: svc.duration_minutes,
    price: svc.price,
    buffer_minutes: (svc as any).buffer_minutes ?? 0,
  })

  const save = () => {
    onUpdate(svc.id, { name: form.name, duration_minutes: form.duration_minutes, price: form.price })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="card p-4 flex flex-col gap-3">
        <input
          className="input"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Nombre del servicio"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Precio CLP</label>
            <input
              type="number"
              className="input"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Margen post-cita</label>
            <div className="flex flex-wrap gap-1.5">
              {[0, 5, 10, 15].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, buffer_minutes: m }))}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                    form.buffer_minutes === m
                      ? 'border-brand-red text-brand-red bg-brand-red/5'
                      : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                  }`}
                >
                  {m === 0 ? '0 min' : `+${m} min`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="label">Duración</label>
          <DurationPresets value={form.duration_minutes} onChange={v => setForm(f => ({ ...f, duration_minutes: v }))} />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={save} className="btn-primary py-1 px-3 text-sm flex items-center gap-1">
            <Check size={13} /> Guardar
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary py-1 px-3 text-sm flex items-center gap-1">
            <X size={13} /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`card flex items-center gap-3 p-3 transition-all ${!svc.is_active ? 'opacity-50' : ''}`}
      draggable
      onDragStart={() => onDragStart(svc.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(svc.id)}
    >
      <GripVertical size={14} className="text-[rgb(var(--fg-secondary))]/40 shrink-0 cursor-grab" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[rgb(var(--fg))] truncate">{svc.name}</p>
        <p className="text-xs text-[rgb(var(--fg-secondary))]">
          {svc.duration_minutes} min · {formatPrice(svc.price)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Toggle on={svc.is_active} onChange={() => onUpdate(svc.id, { is_active: !svc.is_active })} />
        <button
          onClick={() => {
            setEditing(true)
            setForm({ name: svc.name, duration_minutes: svc.duration_minutes, price: svc.price, buffer_minutes: (svc as any).buffer_minutes ?? 0 })
          }}
          className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(svc.id)}
          className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:text-brand-red hover:bg-brand-red/10 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Skeleton de carga ─────────────────────────────────────────────────────────
function ServiciosSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card flex items-center gap-3 p-3">
          <div className="w-3.5 h-5 rounded bg-[rgb(var(--fg-secondary))]/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 rounded-md bg-[rgb(var(--fg-secondary))]/15" />
            <div className="h-3 w-24 rounded-md bg-[rgb(var(--fg-secondary))]/10" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-5 rounded-full bg-[rgb(var(--fg-secondary))]/15" />
            <div className="w-7 h-7 rounded-lg bg-[rgb(var(--fg-secondary))]/10" />
            <div className="w-7 h-7 rounded-lg bg-[rgb(var(--fg-secondary))]/10" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Modal de confirmación genérico ───────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <b className="text-sm text-[rgb(var(--fg))]">{title}</b>
          <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg-secondary))]">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--fg-secondary))] mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm py-1.5 px-4">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn-primary text-sm py-1.5 px-4 bg-brand-red hover:bg-[#bd2f39]"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página de servicios ───────────────────────────────────────────────────────
export default function ServiciosPage() {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [shopId, setShopId] = useState<string | null>(null)
  const [newSvc, setNewSvc] = useState({ name: '', duration_minutes: 30, price: 0 })
  const [dragId, setDragId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: shop } = await supabase.from('barbershops').select('id').eq('admin_id', user.id).single()
    if (!shop) return
    setShopId(shop.id)
    const { data } = await supabase.from('services').select('*').eq('barbershop_id', shop.id).order('sort_order')
    setServices((data as Service[]) ?? [])
    setLoading(false)
  }

  const handleUpdate = async (id: string, data: Partial<Service>) => {
    const { error } = await supabase.from('services').update(data).eq('id', id)
    if (error) return toast.error('Error al actualizar')
    setServices(s => s.map(svc => svc.id === id ? { ...svc, ...data } : svc))
    toast.success('Servicio actualizado')
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) return toast.error('Error al eliminar')
    setServices(s => s.filter(svc => svc.id !== id))
    toast.success('Servicio eliminado')
    setDeleteId(null)
  }

  const handleAdd = async () => {
    if (!newSvc.name.trim() || !shopId) return toast.error('Ingresa el nombre del servicio')
    const { data, error } = await supabase
      .from('services')
      .insert({
        barbershop_id: shopId,
        name: newSvc.name.trim(),
        duration_minutes: newSvc.duration_minutes,
        price: newSvc.price,
        sort_order: services.length,
        is_active: true,
      })
      .select()
      .single()
    if (error) return toast.error('Error al agregar')
    setServices(s => [...s, data as Service])
    setNewSvc({ name: '', duration_minutes: 30, price: 0 })
    setAdding(false)
    toast.success('Servicio agregado')
  }

  // Drag & drop reorder
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const from = services.findIndex(s => s.id === dragId)
    const to = services.findIndex(s => s.id === targetId)
    if (from === -1 || to === -1) return

    const reordered = [...services]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setServices(reordered)
    setDragId(null)

    // Persist sort order
    await Promise.all(
      reordered.map((svc, i) =>
        supabase.from('services').update({ sort_order: i }).eq('id', svc.id)
      )
    )
  }

  const deleteService = services.find(s => s.id === deleteId)

  return (
    <>
      {deleteId && deleteService && (
        <ConfirmModal
          title={`Eliminar "${deleteService.name}"`}
          message="Esta acción no se puede deshacer. Los clientes no podrán reservar este servicio."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
      <Navbar role="admin" />
      <main className="max-w-2xl md:max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Servicios</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
              {services.filter(s => s.is_active).length} activos · {services.length} total
            </p>
          </div>
          <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Agregar
          </button>
        </div>

        {loading ? (
          <ServiciosSkeleton />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Formulario nuevo servicio */}
            {adding && (
              <div className="card p-4 border-brand-red/30 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-[rgb(var(--fg))]">Nuevo servicio</h3>
                <input
                  className="input"
                  placeholder="Nombre del servicio"
                  value={newSvc.name}
                  onChange={e => setNewSvc(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
                <div>
                  <label className="label">Precio (CLP)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="12000"
                    value={newSvc.price || ''}
                    onChange={e => setNewSvc(f => ({ ...f, price: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="label">Duración</label>
                  <DurationPresets
                    value={newSvc.duration_minutes}
                    onChange={v => setNewSvc(f => ({ ...f, duration_minutes: v }))}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleAdd} className="btn-primary py-1.5 px-4 text-sm">Guardar</button>
                  <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 px-4 text-sm">Cancelar</button>
                </div>
              </div>
            )}

            {services.length === 0 && !adding ? (
              <div className="card p-8 text-center">
                <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay servicios. Agrega el primero.</p>
              </div>
            ) : (
              services.map(svc => (
                <ServiceRow
                  key={svc.id}
                  svc={svc}
                  onUpdate={handleUpdate}
                  onDelete={id => setDeleteId(id)}
                  onDragStart={id => setDragId(id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                />
              ))
            )}

            {services.length > 0 && (
              <p className="text-xs text-[rgb(var(--fg-secondary))] text-center mt-1">
                Arrastra para reordenar
              </p>
            )}
          </div>
        )}
      </main>
    </>
  )
}
