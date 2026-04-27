'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/layout/navbar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Check, X, Loader2, Mail, Link as LinkIcon, Trash2 } from 'lucide-react'

interface Worker {
  id: string
  name: string
  specialty: string | null
  is_active: boolean
  calendar_token: string | null
  user_id: string | null
}

export default function BarberosPage() {
  const supabase = createClient()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newWorker, setNewWorker] = useState({ name: '', email: '', specialty: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', specialty: '' })

  useEffect(() => { loadData() }, [])

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
      .from('workers')
      .select('id, name, specialty, is_active, calendar_token, user_id')
      .eq('barbershop_id', shop.id)
      .order('name')
    setWorkers((data as Worker[]) ?? [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!newWorker.name.trim() || !newWorker.email.trim()) {
      return toast.error('Nombre y email son requeridos')
    }
    setAddLoading(true)
    try {
      const res = await fetch('/api/workers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorker.name,
          email: newWorker.email,
          specialty: newWorker.specialty || null,
          barbershop_id: shopId,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message)
      }
      toast.success(`Invitación enviada a ${newWorker.email}`)
      setNewWorker({ name: '', email: '', specialty: '' })
      setAdding(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Error al invitar')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer y borrará su cuenta de acceso.`)) return
    try {
      const res = await fetch('/api/workers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message)
      }
      toast.success(`${name} eliminado`)
      setWorkers(w => w.filter(wk => wk.id !== id))
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('workers')
      .update({ is_active: !current })
      .eq('id', id)
    if (error) return toast.error('Error al actualizar')
    setWorkers(w => w.map(wk => wk.id === id ? { ...wk, is_active: !current } : wk))
    toast.success(!current ? 'Barbero activado' : 'Barbero desactivado')
  }

  const handleEdit = async (id: string) => {
    const { error } = await supabase
      .from('workers')
      .update({ name: editForm.name, specialty: editForm.specialty || null })
      .eq('id', id)
    if (error) return toast.error('Error al actualizar')
    setWorkers(w => w.map(wk => wk.id === id ? { ...wk, ...editForm, specialty: editForm.specialty || null } : wk))
    setEditId(null)
    toast.success('Actualizado')
  }

  const calendarUrl = (token: string | null) =>
    token
      ? `https://${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '')}/api/calendar/${token}`
      : null

  return (
    <>
      <Navbar role="admin" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Barberos</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
              {workers.filter(w => w.is_active).length} activos
            </p>
          </div>
          <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Invitar
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
                <h3 className="text-sm font-semibold">Invitar barbero</h3>
                <input
                  className="input"
                  placeholder="Nombre"
                  value={newWorker.name}
                  onChange={e => setNewWorker(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
                <input
                  type="email"
                  className="input"
                  placeholder="Email (recibirá invitación)"
                  value={newWorker.email}
                  onChange={e => setNewWorker(f => ({ ...f, email: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Especialidad (opcional)"
                  value={newWorker.specialty}
                  onChange={e => setNewWorker(f => ({ ...f, specialty: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={addLoading} className="btn-primary py-1.5 px-4 text-sm">
                    {addLoading ? <Loader2 size={14} className="animate-spin" /> : (
                      <span className="flex items-center gap-1"><Mail size={13} /> Enviar invitación</span>
                    )}
                  </button>
                  <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 px-4 text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {workers.length === 0 && !adding ? (
              <div className="card p-8 text-center">
                <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay barberos. Invita al primero.</p>
              </div>
            ) : (
              workers.map(worker => (
                <div key={worker.id} className={`card p-4 ${!worker.is_active ? 'opacity-60' : ''}`}>
                  {editId === worker.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        className="input"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      />
                      <input
                        className="input"
                        placeholder="Especialidad"
                        value={editForm.specialty}
                        onChange={e => setEditForm(f => ({ ...f, specialty: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(worker.id)} className="btn-primary py-1 px-3 text-sm flex items-center gap-1">
                          <Check size={12} /> Guardar
                        </button>
                        <button onClick={() => setEditId(null)} className="btn-secondary py-1 px-3 text-sm flex items-center gap-1">
                          <X size={12} /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-sm font-bold shrink-0">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[rgb(var(--fg))]">{worker.name}</p>
                          {worker.specialty && (
                            <p className="text-xs text-[rgb(var(--fg-secondary))]">{worker.specialty}</p>
                          )}
                          <p className="text-xs text-[rgb(var(--fg-secondary))]/60 mt-0.5">
                            {worker.user_id ? '✓ Cuenta activa' : '⏳ Invitación pendiente'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleActive(worker.id, worker.is_active)}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                              worker.is_active
                                ? 'border-green-500/30 text-green-500 hover:bg-green-500/10'
                                : 'border-[rgb(var(--fg-secondary))]/20 text-[rgb(var(--fg-secondary))]'
                            }`}
                          >
                            {worker.is_active ? 'Activo' : 'Inactivo'}
                          </button>
                          <button
                            onClick={() => {
                              setEditId(worker.id)
                              setEditForm({ name: worker.name, specialty: worker.specialty ?? '' })
                            }}
                            className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(worker.id, worker.name)}
                            className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-brand-red/10 hover:text-brand-red transition-all"
                            title="Eliminar barbero"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {worker.calendar_token && (
                        <div className="mt-3 pt-3 border-t border-[rgb(var(--fg-secondary))]/10">
                          <p className="text-xs text-[rgb(var(--fg-secondary))] mb-1.5">Link de calendario:</p>
                          <a
                            href={`webcal://${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '')}/api/calendar/${worker.calendar_token}`}
                            className="text-xs text-brand-red flex items-center gap-1 hover:underline"
                          >
                            <LinkIcon size={10} /> Suscribir a calendario
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </>
  )
}
