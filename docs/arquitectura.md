# Architecture

**CronoCorte** is a SaaS barbershop booking platform built on Next.js 14 (App Router) + Supabase + Tailwind CSS.

## Route groups and their roles

| Group | Path prefix | Who uses it |
|---|---|---|
| `(auth)` | `/login`, `/register`, `/reset-password`, `/accept-invite` | All users |
| `(admin)` | `/dashboard/**`, `/onboarding` | Barbershop admin (role = `admin`) |
| `(worker)` | `/agenda` | Barber employees (role = `worker`) |
| Public | `/[slug]`, `/cancelar/[token]` | Clients (no auth) |

Root `page.tsx` reads `user_profiles.role` and redirects: `worker` → `/agenda`, otherwise → `/dashboard`.

## Core data model (see `src/types/database.ts`)

- **Barbershop** — owned by one admin; has `slug` (public booking URL), `schedule_config` (JSON), `payment_info`, AI agent config (`agent_name`, `agent_tone`, `agent_prompt_custom`, `agent_enabled`), and `accent_color`.
- **Worker** — belongs to a barbershop; has a `calendar_token` for iCal export.
- **Service** — belongs to a barbershop; has `price` (CLP) and `duration_min`.
- **Availability** — per-worker weekly schedule (day_of_week 0–6, HH:MM times).
- **Appointment** — joins barbershop + worker + service + client; status lifecycle: `pending_payment` → `confirmed` → `completed` (or `cancelled`). Has `booking_group_id` for group bookings, `cancel_token` for client self-cancellation, and reminder flags.

Known legacy columns (don't be surprised if both exist — see the `db-migrations` subagent for details): `workers.specialties` (legacy) vs `workers.specialty` (used), `workers.photo_url` (legacy) vs `workers.avatar_url` (used), `availability.is_active` (legacy) vs `availability.is_available` (used).

## Supabase clients

- `src/lib/supabase/client.ts` — browser client for Client Components.
- `src/lib/supabase/server.ts` — server client and admin client (service role) for Route Handlers and Server Components.

Always use `createAdminClient()` in API routes that write data or need to bypass RLS. Never expose the service-role key on the client.

## Theming

Each barbershop has an `accent_color` (hex). `accentColorVars()` in `src/lib/utils.ts` converts it to CSS custom properties (`--red`, `--red-dark`, `--red-light`) injected into the public booking page. The admin dashboard always uses the default red (`#e63946`).

## Time zone handling

All slot calculations and date comparisons use `America/Santiago`. Appointments are stored as ISO strings with the client's local UTC offset (built in `buildTimestamps` in `booking-flow.tsx`). When comparing existing appointments against slots, both are converted to Chile wall-clock time to avoid cross-timezone mismatches.

## Worker iCal feed (`/api/calendar/[token]`)

Each worker has a unique `calendar_token`. `GET /api/calendar/[token]` returns an `.ics` file covering 7 days in the past to 90 days in the future. Dates are emitted as UTC (no timezone field in the calendar) so Apple Calendar / Google Calendar auto-convert to the device's local timezone. Do not add a `timezone` property to events — it caused double offsets in testing.

## Environment variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
TWILIO_TEMPLATE_CONFIRMACION
TWILIO_TEMPLATE_RECORDATORIO_24H
TWILIO_TEMPLATE_RECORDATORIO_1H
NEXT_PUBLIC_APP_URL
CRON_SECRET
```
