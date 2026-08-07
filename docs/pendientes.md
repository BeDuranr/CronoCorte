# CronoCorte — Backlog de bugs y mejoras

> Backlog vivo. Actualízalo al resolver algo (muévelo a "Resuelto") o al descubrir algo nuevo.
> El historial de cambios ya aplicados por sesión vive en `docs/sesiones/`, no aquí.

## ✅ Lo que está bien (referencia)

- Arquitectura clara: Next.js 14 (App Router) + Supabase (RLS) + Twilio WhatsApp + Groq (agente IA y verificación de comprobantes).
- Tokens de cancelación seguros (32 bytes random), firma Twilio verificada con `timingSafeEqual`.
- Buenos índices en `appointments`, tests presentes, `.env.local` fuera de git.
- Separación de roles admin/worker/público con doble verificación (middleware + páginas).

---

## 🔴 Críticos (seguridad) — todos resueltos por ahora

- ~~`total_amount` lo define el cliente~~ ✅ Calculado server-side desde `service_id` en DB.
- ~~RLS de `workers` expone `calendar_token` y `phone` a anónimos~~ ✅ Vista `public_workers` con columnas seguras; `/[slug]` la consulta.
- ~~Doble reserva por condición de carrera~~ ✅ Constraint de exclusión `no_double_booking`, error 23P01 manejado con 409.
- ~~`/api/agent/chat` sin rate limit~~ ✅ 20 req/min por IP con contador en memoria.
- ~~`cancel_token` derivable en reservas grupales~~ ✅ Tokens de acompañantes son UUIDs independientes.

---

## 🟠 Bugs e inconsistencias

| # | Problema | Dónde | Fix propuesto | Estado |
|---|----------|-------|-----|--------|
| 1 | `schema.sql` desincronizado con el código real | `supabase/schema.sql` | Volcar schema real y versionar con migraciones CLI | 🟠 Pendiente |
| 2 | Webhook aplica comprobante a "la cita más próxima" del teléfono; puede confirmar la equivocada si hay 2 pendientes | `api/whatsapp/webhook/route.ts` | Asociar flujo de pago a cita específica | 🟠 Pendiente |

Resueltos: policy muerta `cancel by token` (eliminada), `booking-flow.backup.tsx` versionado por error (eliminado), `/api/whatsapp/notify` público sin protección (ahora requiere `cancel_token`).

---

## 🟡 Optimizaciones

| # | Optimización | Estado |
|---|-------------|--------|
| 1 | Middleware consulta `user_profiles` en cada request — guardar rol en JWT claim | 🟡 Pendiente |
| 2 | Service role usado de más en `create`, `availability`, `cancel` | 🟡 Pendiente |
| 3 | Chequeo de conflictos en `create` hace 1 query por bloque | 🟡 Pendiente |
| 4 | `booking-flow.tsx` con ~1100 líneas — dividir en componentes | 🟡 Pendiente |

Resueltas: cron en loop secuencial (ahora `Promise.allSettled`), dependencias muertas `@google/genai`/`@google/generative-ai` (eliminadas), página pública sin caché (ahora ISR `revalidate=300`), falta de validación server-side de `worker_id`/`service_id` (agregada).

---

## Pendiente aparte: cambio de display name WhatsApp

- Ticket abierto en Twilio para cambiar "JamonBarber" → "CronoCorte".
- Bloqueado por verificación de negocio en Meta (requiere certificado SII).
- Logo SVG ya generado (`cronocorte-logo.svg`, 640×640px) y subido a Twilio.
- Retomar cuando se tenga inicio de actividades en SII.

---

## Orden sugerido

1. Bug #2 (webhook con múltiples citas pendientes) — afecta directamente a clientes reales.
2. Bug #1 (schema desincronizado) — base para trabajo futuro con migraciones versionadas.
3. Optimizaciones según tiempo disponible.
4. Cambio display name WhatsApp → cuando se tenga certificado SII.

> Nota: una versión anterior de este documento listaba "RLS workers expone calendar_token" como pendiente en este orden sugerido, pero ese ítem ya está marcado como resuelto arriba — quedó desactualizado. Lo dejo fuera de la lista; avísame si en realidad seguía pendiente algo específico de ahí.
