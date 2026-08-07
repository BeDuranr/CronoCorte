# AI chat agent (`/api/agent/chat`)

Groq-powered barbershop assistant, widget shown on the public booking page.

## Architecture

- Text messages → `llama-3.3-70b-versatile`
- Image messages → `meta-llama/llama-4-scout-17b-16e-instruct`
- The agent widget is **per-barbershop** and activated via the `agent_enabled` toggle in Configuración. When enabled, it shows a hair/face recommendation chat widget on the public booking page (`/[slug]`).
- The agent **only handles image/text via `/api/agent/chat`**, called directly from the widget in the browser — there's no server-side WhatsApp integration for it.
- Rate limited to 20 req/min per IP using an in-memory Map (sufficient for single-instance dev; Vercel multi-instance is acceptable since it just throttles abuse).

## Role and guardrails (do not weaken these)

- The agent's role is **only** to analyze hair/face photos and answer barbershop questions.
- It must **never** offer to schedule appointments — this is enforced via hardcoded guardrails appended after any custom prompt (`agent_prompt_custom`), and **cannot be overridden by admin-provided prompts**.
- **The agent is fully decoupled from WhatsApp** — `agent_enabled` has no effect on WhatsApp messages. The Twilio webhook (`/api/whatsapp/webhook`) never auto-replies to client text messages; it only uses Groq's vision model to validate payment receipt images (see `docs/flujo-pagos-whatsapp.md`). If a task description implies "make the agent respond on WhatsApp," stop and confirm with the user — it contradicts the current design.
