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

Ninguno abierto por ahora.

Resueltos: policy muerta `cancel by token` (eliminada), `booking-flow.backup.tsx` versionado por error (eliminado), `/api/whatsapp/notify` público sin protección (ahora requiere `cancel_token`), **webhook confirmaba "la cita más próxima" en vez de la correcta** (`src/lib/receipt-matching.ts`: `selectReceiptTarget` + `matchRecipient` deciden por monto ±5% y datos del destinatario cuando hay varias citas pendientes del mismo teléfono; commits `27c9a4a3`/`50ea7aac`, 2026-07-10/14, con tests en `receipt-matching.test.ts`), **`schema.sql` desincronizado** (regenerado 2026-08-24 incorporando `slot_interval_minutes`, policies+constraint de `blocked_slots`, y bucket/policies de `barbershop-logos`; verificado tabla/columna por columna contra la API REST en vivo de Supabase — la decisión de migrar a Supabase CLI quedó descartada por ahora, se sigue versionando con archivos `.sql` sueltos aplicados a mano en el Dashboard. Pendiente aparte, no bloqueante: policies/índices/constraints no se re-verificaron contra `pg_policies`/`pg_indexes` en vivo porque el MCP de Supabase no estuvo disponible en esa sesión — se transcribieron desde los 4 archivos de migración ya aplicados, que son la fuente de verdad documentada).

---

## 🟡 Optimizaciones

| # | Optimización | Estado |
|---|-------------|--------|
| 1 | Middleware consulta `user_profiles` en cada request — guardar rol en JWT claim | 🟡 Pendiente — confirmado, `middleware.ts:45-49` sigue haciendo el `select` por request |
| 2 | Service role usado de más en `create`, `availability`, `cancel` | 🟡 Pendiente — confirmado, los tres siguen usando solo `createAdminClient()` |
| 3 | Chequeo de conflictos en `create` hace 1 query por bloque | 🟡 Pendiente — confirmado, `appointments/create/route.ts:126-145` hace 2 queries (`appointments` + `blocked_slots`) por cada bloque en el loop |
| 4 | `booking-flow.tsx` con ~1100 líneas — dividir en componentes | 🟡 Pendiente — empeoró: ahora son 1252 líneas |

Resueltas: cron en loop secuencial (ahora `Promise.allSettled`), dependencias muertas `@google/genai`/`@google/generative-ai` (eliminadas), página pública sin caché (ahora ISR `revalidate=300`), falta de validación server-side de `worker_id`/`service_id` (agregada).

---

## ✅ Resuelto aparte: cambio de display name WhatsApp

- Ticket de Twilio resuelto: "JamonBarber" → "CronoCorte", con número nuevo.
- Certificado de inicio de actividades SII ya obtenido, verificación de negocio en Meta completada.

---

## Orden sugerido

1. Optimizaciones según tiempo disponible.

> Nota: una versión anterior de este documento listaba "RLS workers expone calendar_token" como pendiente en este orden sugerido, pero ese ítem ya está marcado como resuelto arriba — quedó desactualizado. Lo dejo fuera de la lista; avísame si en realidad seguía pendiente algo específico de ahí.
