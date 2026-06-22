'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

interface Props {
  cancelToken: string
  clientName: string
  rescheduleUrl: string
}

export function CancelActions({ cancelToken, clientName, rescheduleUrl }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleCancel = async () => {
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
    } catch (err: any) {
      toast.error(err.message || 'Error al cancelar')
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  // Estado: cancelado con éxito → ofrecer nueva reserva
  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <CheckCircle2 size={36} className="text-green-500" />
          <p className="font-semibold text-[rgb(var(--fg))]">Cita cancelada</p>
          <p className="text-xs text-[rgb(var(--fg-secondary))]">La barbería ha sido notificada.</p>
        </div>
        <a href={rescheduleUrl} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
          <RefreshCw size={14} /> Reservar otra hora
        </a>
      </div>
    )
  }

  // Estado: pidiendo confirmación
  if (confirming) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-center text-[rgb(var(--fg-secondary))]">
          ¿Seguro que quieres cancelar la cita de <b className="text-[rgb(var(--fg))]">{clientName}</b>?
        </p>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-brand-red text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#bd2f39] transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : 'Sí, cancelar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="w-full text-sm text-center text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))] transition-colors"
        >
          No, volver
        </button>
      </div>
    )
  }

  // Estado por defecto: reprogramar primario, cancelar secundario
  return (
    <div className="flex flex-col gap-3">
      {/* CTA principal: reprogramar */}
      <a
        href={rescheduleUrl}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        <RefreshCw size={14} /> Cambiar fecha u hora
      </a>

      {/* CTA secundario: cancelar */}
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-2.5 rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--fg))] font-medium text-sm flex items-center justify-center hover:border-brand-red hover:text-brand-red transition-colors"
      >
        Cancelar mi reserva
      </button>
    </div>
  )
}
