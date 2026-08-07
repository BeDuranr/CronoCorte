# Booking flow & reservation rules

## Booking flow (`src/app/[slug]/booking-flow.tsx`)

Multi-step wizard (Client Component):
1. **Services** — select services per person; supports group bookings (multiple people, one worker).
2. **Worker** — skipped automatically if only one worker exists.
3. **DateTime** — slot grid fetched from `/api/availability`; cached in a `useRef` Map to avoid redundant fetches; uses Chile timezone (`America/Santiago`) for slot calculation.
4. **Confirm** — client name + Chilean phone (+56 prefix added automatically); creates appointments via `/api/appointments/create`.

After booking, a success screen shows a 30-minute countdown for payment, transfer data with per-field copy buttons, a WhatsApp deeplink with a pre-filled message, and an `.ics` download.

## Availability API (`/api/availability`)

Public endpoint — no auth required. Returns only `{starts_at, ends_at}` ranges (never client names or phones) to avoid leaking personal data to anonymous booking clients. Queries ±1 day around the requested date to cover UTC/Chile boundary shifts.

## Business rules — Reservas y citas

- **Prices are in CLP (Chilean pesos)**; always use `formatPrice()` from `src/lib/utils.ts` to display them.
- **Phone numbers** are stored with country code (`+56...`). The booking form auto-prepends `+56` if not already present.
- **Pending payment timeout is 30 minutes** — the cron auto-cancels and the client UI shows a countdown. Reminders are only sent for `confirmed` appointments (not `pending_payment`).
- **Slot granularity is configurable per barbershop** (`barbershops.slot_interval_minutes`, one of 15/30/60, default 60) via `calculateAvailableSlots`'s `slotIntervalMinutes` param, set in Configuración > Horarios. Minimum booking advance is 60 minutes from now (Chile time).
- **Group bookings**: multiple people book with the same worker on the same day; each person gets their own `Appointment` row sharing a `booking_group_id` and `total_amount`. The cancel token is shared (first block only). When verifying a group payment, all rows in the group are confirmed at once.
- **Extra services per person** (e.g., corte + barba) are stored in the `notes` field as `"Servicios adicionales: name1, name2"`. The primary service is `service_id`; extras are in `extra_service_ids`. The `total_amount` is always calculated server-side from the DB prices — never trusted from the client.
- **Anti-spam limit**: max 3 `pending_payment` appointments per phone number at a time. Exceeding this returns HTTP 429.
- **Conflict detection**: The server checks for overlapping appointments before inserting. PostgreSQL exclusion constraint (error code `23P01`) provides a second layer against concurrent double-bookings.

## Business rules — Cancelación

- **Cancel policy** is set per barbershop (`cancel_policy` field): `libre` (always allowed), `2h` (blocked within 2h of appointment), `24h` (blocked within 24h). Default is `2h`.
- The `/cancelar/[token]` page enforces the policy client-side and shows the policy text. The page is public (no auth) — security relies on the unguessable `cancel_token` UUID.
- **Refunds are manual**: if the client already paid, the cancellation page shows a note that the barbershop will coordinate the refund via WhatsApp. There is no automated refund flow.
