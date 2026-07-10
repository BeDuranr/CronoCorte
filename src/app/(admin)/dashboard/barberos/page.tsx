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

// ── Skeleton de carga ─────────────────────────────────────────────────────────
function BarberosSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgb(var(--fg-secondary))]/15 shrink-0" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-4 w-32 rounded-md bg-[rgb(var(--fg-secondary))]/15" />
              <div className="h-3 w-20 rounded-md bg-[rgb(var(--fg-secondary))]/10" />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-9 h-5 rounded-full bg-[rgb(var(--fg-secondary))]/15" />
              <div className="w-7 h-7 rounded-lg bg-[rgb(var(--fg-secondary))]/10" />
              <div className="w-7 h-7 rounded-lg bg-[rgb(var(--fg-secondary))]/10" />
            </div>
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

// ── Chip de estado de la cuenta ───────────────────────────────────────────────
function AccountStatus({ hasAccount }: { hasAccount: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${hasAccount ? 'text-green-500' : 'text-[rgb(var(--fg-secondary))]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${hasAccount ? 'bg-green-500' : 'bg-[rgb(var(--fg-secondary))]/50'}`} />
      {hasAccount ? 'Con cuenta' : 'Sin cuenta'}
    </span>
  )
}

export default function BarberosPage() {
  const supabase = createClient()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newWorker, setNewWorker] = useState({ name: '', email: '', specialty: '' })
  const [withAccount, setWithAccount] = useState(true)
  const [addLoading, setAddLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', specialty: '' })
  const [grantId, setGrantId] = useState<string | null>(null)
  const [grantEmail, setGrantEmail] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [deleteWorker, setDeleteWorker] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: shop } = await supabase.from('barbershops').select('id').eq('admin_id', user.id).single()
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
    if (!newWorker.name.trim()) {
      return toast.error('El nombre es requerido')
    }
    if (withAccount && !newWorker.email.trim()) {
      return toast.error('El email es requerido para crear una cuenta')
    }
    setAddLoading(true)
    try {
      const endpoint = withAccount ? '/api/workers/invite' : '/api/workers/create'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorker.name,
          email: withAccount ? newWorker.email : undefined,
          specialty: newWorker.specialty || null,
          barbershop_id: shopId,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.message) }
      toast.success(
        withAccount
          ? `Invitación enviada a ${newWorker.email}`
          : `${newWorker.name} agregado`
      )
      setNewWorker({ name: '', email: '', specialty: '' })
      setWithAccount(true)
      setAdding(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar barbero')
    } finally {
      setAddLoading(false)
    }
  }

  // "Dar acceso": envía invitación por correo y enlaza la cuenta al barbero
  // sin cuenta existente (no crea un registro nuevo).
  const handleGrant = async (worker: Worker) => {
    if (!grantEmail.trim()) {
      return toast.error('Ingresa el email del barbero')
    }
    setGrantLoading(true)
    try {
      const res = await fetch('/api/workers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: worker.id,
          name: worker.name,
          email: grantEmail.trim(),
          specialty: worker.specialty,
          barbershop_id: shopId,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.message) }
      toast.success(`Invitación enviada a ${grantEmail.trim()}`)
      setGrantId(null)
      setGrantEmail('')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Error al dar acceso')
    } finally {
      setGrantLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch('/api/workers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: id }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.message) }
      toast.success(`${name} eliminado`)
      setWorkers(w => w.filter(wk => wk.id !== id))
      setDeleteWorker(null)
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar')
    }
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('workers').update({ is_active: !current }).eq('id', id)
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
      ? `webcal://${process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '')}/api/calendar/${token}`
      : null

  const activeCount = workers.filter(w => w.is_active).length

  return (
    <>
      {deleteWorker && (
        <ConfirmModal
          title={`Eliminar a ${deleteWorker.name}`}
          message="Esta acción no se puede deshacer. El barbero perderá acceso a la plataforma."
          confirmLabel="Eliminar"
          onConfirm={() => handleDelete(deleteWorker.id, deleteWorker.name)}
          onClose={() => setDeleteWorker(null)}
        />
      )}
      <Navbar role="admin" />
      <main className="max-w-2xl md:max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--fg))]">Barberos</h1>
            <p className="text-sm text-[rgb(var(--fg-secondary))] mt-0.5">
              {activeCount} activo{activeCount !== 1 ? 's' : ''} · {workers.length} total
            </p>
          </div>
          <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Agregar
          </button>
        </div>

        {loading ? (
          <BarberosSkeleton />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Formulario invitar */}
            {adding && (
              <div className="card p-4 border-brand-red/30 flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Agregar barbero</h3>

                {/* Selector de modo: con cuenta / sin cuenta */}
                <div>
                  <p className="label mb-1.5">¿Tendrá acceso a la app?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setWithAccount(true)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        withAccount
                          ? 'border-brand-red bg-brand-red/5'
                          : 'border-[rgb(var(--fg-secondary))]/20 hover:border-[rgb(var(--fg-secondary))]/40'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-[rgb(var(--fg))]">Con cuenta</span>
                      <span className="block text-[11px] text-[rgb(var(--fg-secondary))] mt-0.5">
                        Recibe invitación y ve su agenda
                      </span>
                    </button>
                    <button
                      onClick={() => setWithAccount(false)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        !withAccount
                          ? 'border-brand-red bg-brand-red/5'
                          : 'border-[rgb(var(--fg-secondary))]/20 hover:border-[rgb(var(--fg-secondary))]/40'
                      }`}
                    >
                      <span className="block text-xs font-semibold text-[rgb(var(--fg))]">Sin cuenta</span>
                      <span className="block text-[11px] text-[rgb(var(--fg-secondary))] mt-0.5">
                        Tú gestionas su agenda
                      </span>
                    </button>
                  </div>
                </div>

                <input
                  className="input"
                  placeholder="Nombre"
                  value={newWorker.name}
                  onChange={e => setNewWorker(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
                {withAccount && (
                  <input
                    type="email"
                    className="input"
                    placeholder="Email (recibirá invitación)"
                    value={newWorker.email}
                    onChange={e => setNewWorker(f => ({ ...f, email: e.target.value }))}
                  />
                )}
                <input
                  className="input"
                  placeholder="Especialidad (opcional)"
                  value={newWorker.specialty}
                  onChange={e => setNewWorker(f => ({ ...f, specialty: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={addLoading} className="btn-primary py-1.5 px-4 text-sm">
                    {addLoading
                      ? <Loader2 size={14} className="animate-spin" />
                      : withAccount
                      ? <span className="flex items-center gap-1"><Mail size={13} /> Enviar invitación</span>
                      : <span className="flex items-center gap-1"><Plus size={13} /> Agregar barbero</span>}
                  </button>
                  <button onClick={() => { setAdding(false); setWithAccount(true) }} className="btn-secondary py-1.5 px-4 text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {workers.length === 0 && !adding ? (
              <div className="card p-8 text-center">
                <p className="text-[rgb(var(--fg-secondary))] text-sm">No hay barberos. Agrega al primero para poder recibir reservas.</p>
              </div>
            ) : (
              workers.map(worker => (
                <div
                  key={worker.id}
                  className={`card p-4 ${!worker.is_active ? 'opacity-60' : ''} ${!worker.user_id ? 'border-dashed' : ''}`}
                >
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
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center text-sm font-bold shrink-0 ${!worker.user_id ? 'opacity-50' : ''}`}>
                          {worker.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[rgb(var(--fg))]">{worker.name}</p>
                            <AccountStatus hasAccount={!!worker.user_id} />
                          </div>
                          {worker.specialty && (
                            <p className="text-xs text-[rgb(var(--fg-secondary))]">{worker.specialty}</p>
                          )}

                          {/* Barbero sin cuenta: dar acceso a la app */}
                          {!worker.user_id && (
                            grantId === worker.id ? (
                              <div className="flex flex-col gap-2 mt-2">
                                <input
                                  type="email"
                                  className="input text-sm py-1.5"
                                  placeholder="Email del barbero"
                                  value={grantEmail}
                                  onChange={e => setGrantEmail(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleGrant(worker)}
                                    disabled={grantLoading}
                                    className="btn-primary py-1 px-3 text-sm flex items-center gap-1"
                                  >
                                    {grantLoading
                                      ? <Loader2 size={12} className="animate-spin" />
                                      : <><Mail size={12} /> Enviar invitación</>}
                                  </button>
                                  <button
                                    onClick={() => { setGrantId(null); setGrantEmail('') }}
                                    className="btn-secondary py-1 px-3 text-sm"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setGrantId(worker.id); setGrantEmail('') }}
                                className="flex items-center gap-1 text-xs text-brand-red font-medium mt-2 hover:underline"
                              >
                                <Mail size={11} /> Dar acceso a la app
                              </button>
                            )
                          )}
                        </div>

                        {/* Controles */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Toggle on={worker.is_active} onChange={() => handleToggleActive(worker.id, worker.is_active)} />
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
                            onClick={() => setDeleteWorker({ id: worker.id, name: worker.name })}
                            className="p-1.5 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-brand-red/10 hover:text-brand-red transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* iCal link */}
                      {worker.calendar_token && (
                        <div className="mt-3 pt-3 border-t border-[rgb(var(--fg-secondary))]/10 flex items-center gap-2">
                          <a
                            href={calendarUrl(worker.calendar_token) ?? '#'}
                            className="text-xs text-brand-red flex items-center gap-1 hover:underline"
                          >
                            <LinkIcon size={10} /> Suscribir a calendario (iCal)
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
