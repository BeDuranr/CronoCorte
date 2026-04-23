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

function ServiceRow({
  svc,
  onUpdate,
  onDelete,
}: {
  svc: Service
  onUpdate: (id: string, data: Partial<Service>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: svc.name, duration_minutes: svc.duration_minutes, price: svc.price })

  const save = () => {
    onUpdate(svc.id, form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="card p-3 flex flex-col gap-2">
        <input
          className="input"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Nombre del servicio"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Duración</label>
            <select
              className="input"
              value={form.duration_minutes}
              onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
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
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex gap-2">
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
    <div className={`card p-3 flex items-center gap-3 ${!svc.is_active ? 'opacity-50' : ''}`}>
      <GripVertical size={14} className="text-[rgb(var(--fg-secondary))]/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[rgb(var(--fg))] truncate">{svc.name}</p>
        <p className="text-xs text-[rgb(var(--fg-secondary))]">{svc.duration_minutes} min · {formatPrice(svc.price)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onUpdate(svc.id, { is_active: !svc.is_active })}
          className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
            svc.is_active
              ? 'border-green-500/30 text-green-500 hover:bg-green-500/10'
              : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))] hover:border-brand-red/30'
          }`}
        >
          {svc.is_active ? 'Activo' : 'Inactivo'}
        </button>
        <button
          onClick={() => setEditing(true)}
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

export default function ServiciosPage() {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [shopId, setShopId] = useState<string | null>(null)
  const [newSvc, setNewSvc] = useState({ name: '', duration_minutes: 30, price: 0 })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shop } = await supabase
      .from('barbershops')
      .select('id')
      .eq('admin_id', user.id)
      .single()

    if (!shop) return
    setShopId(shop.id)

    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('barbershop_id', shop.id)
      .order('sort_order')

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
    if (!confirm('¿Eliminar este servicio?')) return
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) return toast.error('Error al eliminar')
    setServices(s => s.filter(svc => svc.id !== id))
    toast.success('Servicio eliminado')
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

  return (
    <>
      <Navbar role="admin" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Servicios</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
              {services.filter(s => s.is_active).length} activos
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={15} /> Agregar
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="animate-spin text-brand-red mx-auto" size={24} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Duración</label>
                    <select
                      className="input"
                      value={newSvc.duration_minutes}
                      onChange={e => setNewSvc(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
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
                      value={newSvc.price || ''}
                      onChange={e => setNewSvc(f => ({ ...f, price: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAdd} className="btn-primary py-1.5 px-4 text-sm">
                    Guardar
                  </button>
                  <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 px-4 text-sm">
                    Cancelar
                  </button>
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
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}
      </main>
    </>
  )
}
