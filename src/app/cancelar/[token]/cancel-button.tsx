'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react'

export function CancelButton({ cancelToken, clientName }: { cancelToken: string; clientName: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleCancel = async () => {
    if (!confirm(`¿Estás seguro de cancelar la cita de ${clientName}?`)) return

    setLoading(true)
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cancelToken }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al cancelar')

      setDone(true)
      toast.success('Cita cancelada')
    } catch (err: any) {
      toast.error(err.message || 'Error al cancelar')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-[rgb(var(--fg))]">Cita cancelada</p>
        <p className="text-sm text-[rgb(var(--fg-secondary))] mt-1">
          La barbería ha sido notificada.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-brand-red text-white font-semibold text-sm
                   flex items-center justify-center gap-2 hover:bg-brand-red-dark transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : (
          <>
            <XCircle size={16} /> Cancelar mi cita
          </>
        )}
      </button>
      <a
        href="/"
        className="text-center text-sm text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors"
      >
        Volver sin cancelar
      </a>
    </div>
  )
}
