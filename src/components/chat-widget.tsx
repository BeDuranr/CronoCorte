'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Camera, Loader2, Scissors, Trash2 } from 'lucide-react'

interface Message {
  role: 'user' | 'agent'
  content: string
  images?: string[]
}

interface Props {
  barbershopId: string
  barbershopSlug: string
  agentName?: string
}

export function ChatWidget({ barbershopId, barbershopSlug, agentName = 'Asistente' }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      content: `¡Hola! Soy ${agentName}, tu asistente de cortes. Súbeme una foto tuya y te digo qué corte te queda mejor según tu cara y tipo de pelo. 📸`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingImages, setPendingImages] = useState<{ base64: string; preview: string; mimeType: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        setPendingImages(prev => [...prev, { base64, preview: dataUrl, mimeType: file.type }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text && pendingImages.length === 0) return

    const displayText = text || (pendingImages.length > 0 ? 'Analiza mi foto' : '')
    const userMsg: Message = {
      role: 'user',
      content: displayText,
      images: pendingImages.map(i => i.preview),
    }

    // Snapshot del historial ANTES de agregar el mensaje actual
    const currentMessages = [...messages]

    setMessages(prev => [...prev, userMsg])
    setInput('')
    const imagesToSend = [...pendingImages]
    setPendingImages([])
    setLoading(true)

    // Historial para el API: solo texto, sin el mensaje del saludo inicial ni imágenes previas
    const history = currentMessages.slice(1).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: displayText,
          images: imagesToSend.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          history,
          barbershop_id: barbershopId,
          barbershop_slug: barbershopSlug,
          from: 'web-chat',
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'agent', content: data.reply }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'agent', content: 'Hubo un problema al conectar. Intenta de nuevo.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Asistente de cortes"
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 ${
          open ? 'bg-[rgb(var(--bg-secondary))]' : 'bg-brand-red'
        }`}
      >
        {open
          ? <X size={22} className="text-[rgb(var(--fg))]" />
          : <Scissors size={22} />
        }
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[340px] h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[rgb(var(--fg-secondary))]/10 bg-[rgb(var(--bg))]">

          {/* Header */}
          <div className="px-4 py-3 bg-brand-red flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Scissors size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{agentName}</p>
              <p className="text-white/70 text-xs">Recomendaciones de corte con IA</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scroll-smooth">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-red text-white rounded-tr-none'
                      : 'bg-[rgb(var(--bg-secondary))] text-[rgb(var(--fg))] rounded-tl-none'
                  }`}
                >
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {msg.images.map((src, j) => (
                        <img
                          key={j}
                          src={src}
                          alt="foto enviada"
                          className="rounded-lg max-h-36 max-w-full object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-brand-red" />
                  <span className="text-xs text-[rgb(var(--fg-secondary))]">Analizando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="px-3 pt-2 flex gap-2 overflow-x-auto shrink-0">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img.preview} alt="" className="h-16 w-16 rounded-xl object-cover border border-brand-red/30" />
                  <button
                    onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand-red rounded-full text-white flex items-center justify-center shadow"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="p-3 border-t border-[rgb(var(--fg-secondary))]/10 flex items-center gap-2 shrink-0">
            <input
              type="file"
              ref={fileRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileRef.current?.click()}
              title="Subir foto"
              className="p-2 rounded-xl text-[rgb(var(--fg-secondary))] hover:text-brand-red hover:bg-brand-red/10 transition-all shrink-0"
            >
              <Camera size={20} />
            </button>
            <input
              ref={inputRef}
              className="flex-1 bg-[rgb(var(--bg-secondary))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--fg))] outline-none placeholder:text-[rgb(var(--fg-secondary))]/60 min-w-0"
              placeholder="Escribe o sube una foto..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && pendingImages.length === 0)}
              className="p-2 rounded-xl bg-brand-red text-white hover:opacity-90 disabled:opacity-40 transition-all shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
