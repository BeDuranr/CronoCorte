# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

**CronoCorte** is a SaaS barbershop booking platform built on Next.js 14 (App Router) + Supabase + Tailwind CSS.

### Route groups and their roles

| Group | Path prefix | Who uses it |
|---|---|---|
| `(auth)` | `/login`, `/register`, `/reset-password`, `/accept-invite` | All users |
| `(admin)` | `/dashboard/**`, `/onboarding` | Barbershop admin (role = `admin`) |
| `(worker)` | `/agenda` | Barber employees (role = `worker`) |
| Public | `/[slug]`, `/cancelar/[token]` | Clients (no auth) |

Root `page.tsx` reads `user_profiles.role` and redirects: `worker` → `/agenda`, otherwise → `/dashboard`.

### Core data model (see `src/types/database.ts`)

- **Barbershop** — owned by one admin; has `slug` (public booking URL), `schedule_config` (JSON), `payment_info`, AI agent config (`agent_name`, `agent_tone`, `agent_prompt_custom`, `agent_enabled`), and `accent_color`.
- **Worker** — belongs to a barbershop; has a `calendar_token` for iCal export.
- **Service** — belongs to a barbershop; has `price` (CLP) and `duration_min`.
- **Availability** — per-worker weekly schedule (day_of_week 0–6, HH:MM times).
- **Appointment** — joins barbershop + worker + service + client; status lifecycle: `pending_payment` → `confirmed` → `completed` (or `cancelled`). Has `booking_group_id` for group bookings, `cancel_token` for client self-cancellation, and reminder flags.

### Supabase clients

- `src/lib/supabase/client.ts` — browser client for Client Components.
- `src/lib/supabase/server.ts` — server client and admin client (service role) for Route Handlers and Server Components.

Always use `createAdminClient()` in API routes that write data or need to bypass RLS. Never expose the service-role key on the client.

### Booking flow (`src/app/[slug]/booking-flow.tsx`)

Multi-step wizard (Client Component):
1. **Services** — select services per person; supports group bookings (multiple people, one worker).
2. **Worker** — skipped automatically if only one worker exists.
3. **DateTime** — slot grid fetched from `/api/availability`; cached in a `useRef` Map to avoid redundant fetches; uses Chile timezone (`America/Santiago`) for slot calculation.
4. **Confirm** — client name + Chilean phone (+56 prefix added automatically); creates appointments via `/api/appointments/create`.

After booking, a success screen shows a 30-minute countdown for payment, transfer data with per-field copy buttons, a WhatsApp deeplink with a pre-filled message, and an `.ics` download.

### Payment verification flow

Payment is confirmed via WhatsApp:
1. Client sends transfer receipt image to the barbershop's WhatsApp number.
2. Twilio webhook (`/api/whatsapp/webhook`) receives the message.
3. The receipt image is fetched with Twilio credentials and sent to Groq vision model (`meta-llama/llama-4-scout-17b-16e-instruct`) which returns `{amount, date, is_valid_receipt, confidence}`.
4. Verification passes if: `is_valid_receipt=true`, confidence ≥ 0.7, amount within ±5% of expected, and date is today or yesterday (Chile timezone).
5. On success, appointment status is updated to `confirmed` and reminders are activated.

### AI chat agent (`/api/agent/chat`)

Groq-powered barbershop assistant:
- Text messages → `llama-3.3-70b-versatile`
- Image messages → `meta-llama/llama-4-scout-17b-16e-instruct`
- The agent's role is **only** to analyze hair/face photos and answer barbershop questions. It must **never** offer to schedule appointments — that is enforced via hardcoded guardrails appended after any custom prompt (cannot be overridden by admin).
- Rate limited to 20 req/min per IP using an in-memory Map (sufficient for single-instance dev; Vercel multi-instance is acceptable since it just throttles abuse).

### Cron (`/api/cron/reminders`)

Runs every 30 minutes (Vercel Cron), protected by `CRON_SECRET`. Handles:
1. 24h reminders for upcoming confirmed appointments.
2. 1h reminders for upcoming confirmed appointments.
3. Auto-cancel `pending_payment` appointments older than 30 minutes.
4. Auto-complete `confirmed` appointments whose `ends_at` has passed.

Reminders use **Twilio template messages** (Meta-approved), configured via `TWILIO_TEMPLATE_RECORDATORIO_24H` and `TWILIO_TEMPLATE_RECORDATORIO_1H` env vars.

### Theming

Each barbershop has an `accent_color` (hex). `accentColorVars()` in `src/lib/utils.ts` converts it to CSS custom properties (`--red`, `--red-dark`, `--red-light`) injected into the public booking page. The admin dashboard always uses the default red (`#e63946`).

### Time zone handling

All slot calculations and date comparisons use `America/Santiago`. Appointments are stored as ISO strings with the client's local UTC offset (built in `buildTimestamps` in `booking-flow.tsx`). When comparing existing appointments against slots, both are converted to Chile wall-clock time to avoid cross-timezone mismatches.

### Worker iCal feed (`/api/calendar/[token]`)

Each worker has a unique `calendar_token`. `GET /api/calendar/[token]` returns an `.ics` file covering 7 days in the past to 90 days in the future. Dates are emitted as UTC (no timezone field in the calendar) so Apple Calendar / Google Calendar auto-convert to the device's local timezone. Do not add a `timezone` property to events — it caused double offsets in testing.

### WhatsApp notification on booking (`/api/whatsapp/notify`)

Called fire-and-forget from `booking-flow.tsx` after a successful reservation. Sends a Twilio template message (`TWILIO_TEMPLATE_CONFIRMACION`) with variables:
- `{{1}}` client name, `{{2}}` barbershop name, `{{3}}` booking detail, `{{4}}` total amount, `{{5}}` transfer data.

**Template variable constraints**: Twilio/Meta rejects variables containing `$`, `#`, `%`, `+`, newlines, or 5+ consecutive spaces. The route sanitizes all values with `ensureString()` before sending.

Amount is formatted without the `$` sign (e.g., `"7.000 CLP"`) for the same reason.

### Availability API (`/api/availability`)

Public endpoint — no auth required. Returns only `{starts_at, ends_at}` ranges (never client names or phones) to avoid leaking personal data to anonymous booking clients. Queries ±1 day around the requested date to cover UTC/Chile boundary shifts.

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

## Key business rules

### Reservas y citas

- **Prices are in CLP (Chilean pesos)**; always use `formatPrice()` from `src/lib/utils.ts` to display them.
- **Phone numbers** are stored with country code (`+56...`). The booking form auto-prepends `+56` if not already present.
- **Pending payment timeout is 30 minutes** — the cron auto-cancels and the client UI shows a countdown. Reminders are only sent for `confirmed` appointments (not `pending_payment`).
- **Slot granularity is 1 hour** (hardcoded in `calculateAvailableSlots`). Minimum booking advance is 60 minutes from now (Chile time).
- **Group bookings**: multiple people book with the same worker on the same day; each person gets their own `Appointment` row sharing a `booking_group_id` and `total_amount`. The cancel token is shared (first block only). When verifying a group payment, all rows in the group are confirmed at once.
- **Extra services per person** (e.g., corte + barba) are stored in the `notes` field as `"Servicios adicionales: name1, name2"`. The primary service is `service_id`; extras are in `extra_service_ids`. The `total_amount` is always calculated server-side from the DB prices — never trusted from the client.
- **Anti-spam limit**: max 3 `pending_payment` appointments per phone number at a time. Exceeding this returns HTTP 429.
- **Conflict detection**: The server checks for overlapping appointments before inserting. PostgreSQL exclusion constraint (error code `23P01`) provides a second layer against concurrent double-bookings.

### Cancelación

- **Cancel policy** is set per barbershop (`cancel_policy` field): `libre` (always allowed), `2h` (blocked within 2h of appointment), `24h` (blocked within 24h). Default is `2h`.
- The `/cancelar/[token]` page enforces the policy client-side and shows the policy text. The page is public (no auth) — security relies on the unguessable `cancel_token` UUID.
- **Refunds are manual**: if the client already paid, the cancellation page shows a note that the barbershop will coordinate the refund via WhatsApp. There is no automated refund flow.

### Barberos y acceso

- **Worker invitation**: admin calls `/api/workers/invite` → Supabase sends invite email → worker clicks link → `/accept-invite` page sets password and links `user_profiles` to the worker record. The invite redirects to `NEXT_PUBLIC_APP_URL/accept-invite`.
- **Worker role is read-only for their own data**: workers access `/agenda` (their own appointments). Admins access `/dashboard/**` (full management).
- **Barbershop name is immutable** from the settings UI — the field is disabled. Name changes require a direct DB update (the slug is derived from the name at creation time and is also immutable once set).

### Configuración de la barbería

- **Accent color** applies only to the public booking page (`/[slug]`). The admin dashboard always uses `#e63946`. Preset options: `#e63946`, `#3563d8`, `#3a9b6c`, `#8a56c9`, `#444444`, or any custom hex. The color is injected as CSS variables `--red`, `--red-dark`, `--red-light` at render time.
- **Transfer info format**: written as `"Label: Valor"` one per line. The booking success screen parses this to render per-field copy buttons. Lines without a colon are shown as plain text without a copy button.
- **WhatsApp templates** (confirmation and reminders) require Meta/Twilio approval. Admins cannot edit them directly; they are read-only in the settings UI. To change them, the CronoCorte team must update and re-approve the templates in Twilio.
- **Reminder timings** (`reminder_timings` array on `barbershops`) are configurable: `24h`, `2h`, or both. The cron job at `/api/cron/reminders` reads this field to decide which reminders to send. Columns `cancel_policy`, `reminder_timings`, `whatsapp_template_confirmed`, and `whatsapp_template_reminder` may not exist in older DB schemas — the config page handles their absence gracefully.

### Agente IA

- The agent is **per-barbershop** and activated via `agent_enabled` toggle. When enabled, it auto-replies to WhatsApp text messages via the Twilio webhook.
- **Hardcoded guardrails** are always appended to the system prompt after any custom instructions — they cannot be removed or overridden by admin-provided prompts. The guardrail explicitly forbids the agent from offering to schedule appointments.
- The agent **only handles WhatsApp text/image messages** through the webhook. The chat widget on the booking page (`/[slug]`) is a separate client-side interface that calls `/api/agent/chat` directly.
- The **Twilio webhook signature** is verified in production using HMAC-SHA1; skipped in development.
