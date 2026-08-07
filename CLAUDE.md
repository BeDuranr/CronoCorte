# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.
Detailed docs live in `docs/` and load **on demand** — read only the file(s) the current task needs. See `docs/00-indice.md` for the full map.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests (Vitest, watch mode)
npm run test:ui      # Vitest UI
npm run test:coverage # Coverage report
```

Run a single test file: `npx vitest run src/__tests__/cancel-route.test.ts`

## Project snapshot

**CronoCorte** is a SaaS barbershop booking platform: Next.js 14 (App Router) + Supabase + Tailwind CSS. Full architecture, route groups, and data model: `docs/arquitectura.md`.

## Always-relevant rules

Small enough to keep here always-loaded; everything else is one Read away in `docs/`.

- All slot/date math uses **America/Santiago** — details in `docs/flujo-reservas.md`.
- Prices are **CLP**, always displayed via `formatPrice()`.
- `total_amount` is always recalculated **server-side** — never trust the client's value.
- Always use `createAdminClient()` in API routes that write data or bypass RLS; never expose the service-role key client-side.
- The AI agent (`docs/agente-ia.md`) can **never** offer to schedule appointments — the guardrail is hardcoded and cannot be overridden by admin prompts. It is fully decoupled from WhatsApp.

## Documentación modular

| Cuándo | Archivo |
|---|---|
| Arquitectura, modelo de datos, columnas legacy, env vars | `docs/arquitectura.md` |
| Flujo de reserva, grupos, cancelación | `docs/flujo-reservas.md` |
| Pagos por WhatsApp, webhook Twilio, recordatorios | `docs/flujo-pagos-whatsapp.md` |
| Agente IA y sus guardrails | `docs/agente-ia.md` |
| Invitación de barberos, roles, configuración | `docs/barberos-acceso.md` |
| Backlog de bugs/mejoras pendientes | `docs/pendientes.md` |
| Bitácora de sesiones anteriores | `docs/sesiones/00-indice.md` |

## Al cerrar una sesión de trabajo relevante

Si se tocó código, se tomaron decisiones, o quedó algo pendiente para la próxima vez, deja una entrada en `docs/sesiones/YYYY-MM-DD.md` (y agrégala a `docs/sesiones/00-indice.md`) con: qué se hizo, qué se decidió, y qué queda para después. Si hay un bug o mejora nueva, agrégala también a `docs/pendientes.md`.
