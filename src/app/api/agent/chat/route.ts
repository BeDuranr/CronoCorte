import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const TEXT_MODEL   = 'llama-3.3-70b-versatile'

export async function POST(req: NextRequest) {
  try {
    const { message, images, history = [], barbershop_id, barbershop_slug } = await req.json()

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

    const systemPrompt = shop?.agent_prompt_custom?.trim()
      ? shop.agent_prompt_custom
      : `Eres ${agentName}, el asistente de ${shop?.name || 'la barbería'}.
${toneInstructions[tone] || toneInstructions.relajado}

TU ROL:
- Analizar fotos del cliente para recomendar cortes de pelo según su tipo de rostro y pelo.
- Responder preguntas generales sobre la barbería.

CUANDO EL CLIENTE SUBE FOTOS:
- Analiza la forma del rostro (oval, cuadrada, redonda, triangular, corazón).
- Identifica tipo de pelo (liso, ondulado, rizado) y grosor.
- Recomienda 2-3 estilos de corte que le quedarían bien, con una breve explicación de por qué.

PARA AGENDAR UNA HORA:
- No puedes agendar directamente. Indica al cliente que reserve desde la página: ${bookingUrl}

ESTILO DE RESPUESTA:
- Respuestas cortas y directas. Máximo 3-4 líneas por mensaje.
- Un solo emoji por mensaje, solo si aporta.
- Haz una sola pregunta por mensaje.`

    // Historial
    const historyMessages: Groq.Chat.ChatCompletionMessageParam[] = (history as { role: string; content: string }[]).map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }))

    const hasImages = images && Array.isArray(images) && images.length > 0

    // Con imágenes: modelo de visión
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

    // Solo texto: sin herramientas, respuesta directa
    const response = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      max_tokens: 1024,
    })

    const reply = response.choices[0].message.content
      || 'Disculpa, no entendí bien. ¿Puedes repetirlo?'
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('Agent chat error:', err)
    return NextResponse.json(
      { reply: 'Disculpa, tuve un problema técnico. ¿Puedes intentarlo de nuevo en un momento?' },
      { status: 200 }
    )
  }
}
