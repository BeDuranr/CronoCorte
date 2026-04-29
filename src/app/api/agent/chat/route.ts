import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculateAvailableSlots } from '@/lib/utils'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

// ─── Models ───────────────────────────────────────────────────────────────────
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'  // para imágenes
const TEXT_MODEL   = 'llama-3.3-70b-versatile'         // para texto + tools

// ─── Tool declarations (formato OpenAI) ──────────────────────────────────────
const tools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'Obtiene los servicios disponibles con precio y duración',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_workers',
      description: 'Obtiene los barberos disponibles',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description: 'Obtiene horarios disponibles para una fecha',
      parameters: {
        type: 'object',
        properties: {
          worker_id: { type: 'string', description: 'ID del barbero' },
          date: { type: 'string', description: 'Fecha en YYYY-MM-DD' },
          service_id: { type: 'string', description: 'ID del servicio' },
        },
        required: ['worker_id', 'date', 'service_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Crea una cita para el cliente',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string' },
          client_phone: { type: 'string' },
          worker_id: { type: 'string' },
          service_id: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: 'HH:MM' },
        },
        required: ['client_name', 'client_phone', 'worker_id', 'service_id', 'date', 'time'],
      },
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, any>, barbershopId: string): Promise<string> {
  const supabase = createAdminClient()

  if (name === 'get_services') {
    const { data } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('barbershop_id', barbershopId)
      .eq('is_active', true)
      .order('sort_order')
    if (!data?.length) return 'No hay servicios disponibles.'
    return data.map(s => `• ${s.name} — ${s.duration_minutes} min — $${Number(s.price).toLocaleString('es-CL')} (id: ${s.id})`).join('\n')
  }

  if (name === 'get_workers') {
    const { data } = await supabase
      .from('workers')
      .select('id, name, specialty')
      .eq('barbershop_id', barbershopId)
      .eq('is_active', true)
      .order('name')
    if (!data?.length) return 'No hay barberos disponibles.'
    return data.map(w => `• ${w.name}${w.specialty ? ` (${w.specialty})` : ''} (id: ${w.id})`).join('\n')
  }

  if (name === 'get_availability') {
    const { worker_id, date, service_id } = args
    const { data: service } = await supabase.from('services').select('duration_minutes').eq('id', service_id).single()
    const { data: avail } = await supabase
      .from('availability')
      .select('start_time, end_time')
      .eq('barbershop_id', barbershopId)
      .eq('day_of_week', new Date(date + 'T12:00:00').getDay())
      .eq('is_active', true)
      .single()
    if (!avail) return 'No hay atención ese día.'
    const { data: existing } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('worker_id', worker_id)
      .gte('starts_at', `${date}T00:00:00`)
      .lte('starts_at', `${date}T23:59:59`)
      .not('status', 'eq', 'cancelled')
    const slots = calculateAvailableSlots({ availability: avail, existingAppointments: existing ?? [], serviceDuration: service?.duration_minutes ?? 30, date })
    if (!slots.length) return `No hay horarios disponibles el ${date}.`
    const dateLabel = format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
    return `Horarios disponibles el ${dateLabel}:\n${slots.join(', ')}`
  }

  if (name === 'create_appointment') {
    const { client_name, client_phone, worker_id, service_id, date, time } = args
    const { data: service } = await supabase.from('services').select('duration_minutes').eq('id', service_id).single()
    if (!service) return 'Servicio no encontrado.'
    const end = new Date(`${date}T${time}:00`)
    end.setMinutes(end.getMinutes() + service.duration_minutes)
    const phone = client_phone.startsWith('+') ? client_phone : `+56${client_phone}`
    const { error } = await supabase.from('appointments').insert({
      barbershop_id: barbershopId, worker_id, service_id, client_name, client_phone: phone,
      starts_at: `${date}T${time}:00`, ends_at: end.toISOString().slice(0, 19),
      status: 'pending_payment', cancel_token: crypto.randomUUID().replace(/-/g, ''),
    })
    if (error) return `Error al crear cita: ${error.message}`
    const dateLabel = format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
    return `Cita creada para el ${dateLabel} a las ${time}.`
  }

  return `Herramienta ${name} no reconocida.`
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, images, history = [], barbershop_id, barbershop_slug } = await req.json()

    // Validaciones básicas de entrada
    if (!barbershop_id || typeof barbershop_id !== 'string') {
      return NextResponse.json({ reply: 'Solicitud inválida.' }, { status: 400 })
    }
    if (message && typeof message === 'string' && message.length > 2000) {
      return NextResponse.json({ reply: 'Mensaje demasiado largo.' }, { status: 400 })
    }
    if (Array.isArray(history) && history.length > 40) {
      return NextResponse.json({ reply: 'Historial demasiado largo.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verificar que la barbershop existe y tiene el agente activo
    const { data: shop } = await supabase
      .from('barbershops')
      .select('name, agent_name, agent_tone, agent_prompt_custom, agent_enabled')
      .eq('id', barbershop_id)
      .single()

    if (!shop) {
      return NextResponse.json({ reply: 'Barbería no encontrada.' }, { status: 404 })
    }

    const agentName = shop?.agent_name || 'Asistente'
    const tone = shop?.agent_tone || 'relajado'
    const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${barbershop_slug}`

    const toneInstructions: Record<string, string> = {
      relajado: 'Habla de forma cercana y natural, como un barbero de confianza.',
      formal: 'Habla de forma formal y profesional.',
      juvenil: 'Habla de forma relajada y juvenil.',
    }

    const toolInstructions = `

HERRAMIENTAS (úsalas siempre, nunca inventes datos. Nunca muestres IDs al usuario):
- Preguntan por servicios o precios → get_services
- Preguntan por barberos → get_workers
- Quieren agendar → get_services + get_workers juntos
- Eligen fecha → get_availability
- Confirman todo → create_appointment

FLUJO DE AGENDAMIENTO — sigue este orden, un paso por mensaje:
1. get_services + get_workers → muestra opciones en lista corta → pregunta cuál servicio y barbero
2. Pregunta qué día
3. get_availability → muestra horarios disponibles → pregunta qué hora
4. Pide nombre completo
5. Pide número WhatsApp (sin +56)
6. Resumen en 3 líneas + "¿Confirmo?"
7. Si confirma → create_appointment → "¡Listo, tu hora quedó agendada! 🗓️"

Regla: si el cliente ya dio un dato, no lo vuelvas a pedir. Hoy es ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

PRIVACIDAD: No tienes acceso a citas existentes ni datos de otros clientes. Si preguntan, di: "Eso solo lo puede ver el administrador. Yo te ayudo a agendar una hora nueva."`

    const basePrompt = shop?.agent_prompt_custom?.trim()
      ? shop.agent_prompt_custom
      : `Eres ${agentName}, el asistente de ${shop?.name || 'la barbería'}.
${toneInstructions[tone] || toneInstructions.relajado}

ESTILO DE RESPUESTA — MUY IMPORTANTE:
- Respuestas cortas y directas. Máximo 3-4 líneas por mensaje.
- Un solo emoji por mensaje, solo si aporta. Nunca varios seguidos.
- Nunca uses listas largas ni párrafos explicativos.
- Nunca repitas lo que el cliente ya dijo.
- Haz una sola pregunta por mensaje, nunca dos a la vez.
- Si hay que dar varios datos (servicios, horarios), muéstralos en lista corta sin explicaciones extras.

Puedes ayudar con: analizar fotos para recomendar cortes, responder sobre precios y horarios, y agendar citas.`

    const systemPrompt = basePrompt + toolInstructions

    const hasImages = images && Array.isArray(images) && images.length > 0

    // Historial compartido (roles user/assistant, solo texto)
    const historyMessages: Groq.Chat.ChatCompletionMessageParam[] = (history as { role: string; content: string }[]).map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }))

    // ── Con imágenes: modelo de visión ────────────────────────────────────────
    if (hasImages) {
      const content: Groq.Chat.ChatCompletionContentPart[] = images.map((img: any) => ({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}` },
      }))
      if (message) content.push({ type: 'text', text: message })

      const response = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content },
        ],
        max_tokens: 1024,
      })
      return NextResponse.json({ reply: response.choices[0].message.content })
    }

    // ── Solo texto: modelo con tool use ──────────────────────────────────────
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    let response = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1024,
    })

    // Agentic loop
    let iterations = 0
    while (response.choices[0].finish_reason === 'tool_calls' && iterations < 5) {
      iterations++
      const assistantMsg = response.choices[0].message
      messages.push(assistantMsg)

      for (const tc of assistantMsg.tool_calls ?? []) {
        const args = JSON.parse(tc.function.arguments || '{}')
        const result = await executeTool(tc.function.name, args, barbershop_id)
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }

      response = await groq.chat.completions.create({
        model: TEXT_MODEL,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 1024,
      })
    }

    return NextResponse.json({ reply: response.choices[0].message.content })
  } catch (err: any) {
    console.error('Agent chat error:', err)
    return NextResponse.json({ reply: `Error: ${err?.message || 'Error desconocido'}` }, { status: 200 })
  }
}
