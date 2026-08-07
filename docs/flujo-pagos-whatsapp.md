# Payment verification & WhatsApp flows

## Payment verification flow

Payment is confirmed via WhatsApp:
1. Client sends transfer receipt image to the barbershop's WhatsApp number.
2. Twilio webhook (`/api/whatsapp/webhook`) receives the message.
3. The receipt image is fetched with Twilio credentials and sent to Groq vision model (`meta-llama/llama-4-scout-17b-16e-instruct`) which returns `{amount, date, is_valid_receipt, confidence}`.
4. Verification passes if: `is_valid_receipt=true`, confidence ≥ 0.7, amount within ±5% of expected, and date is today or yesterday (Chile timezone).
5. On success, appointment status is updated to `confirmed` and reminders are activated.

Known open bug (see `docs/pendientes.md`): the webhook applies the receipt to "the client's nearest pending appointment" by phone — it can confirm the wrong one if there are 2+ pending appointments for the same phone.

## WhatsApp notification on booking (`/api/whatsapp/notify`)

Called fire-and-forget from `booking-flow.tsx` after a successful reservation. Sends a Twilio template message (`TWILIO_TEMPLATE_CONFIRMACION`) with variables:
- `{{1}}` client name, `{{2}}` barbershop name, `{{3}}` booking detail, `{{4}}` total amount, `{{5}}` transfer data.

**Template variable constraints**: Twilio/Meta rejects variables containing `$`, `#`, `%`, `+`, newlines, or 5+ consecutive spaces. The route sanitizes all values with `ensureString()` before sending.

Amount is formatted without the `$` sign (e.g., `"7.000 CLP"`) for the same reason.

Requires the client's `cancel_token` to trigger — prevents anonymous parties from spamming resends.

## Cron (`/api/cron/reminders`)

Runs every 30 minutes (Vercel Cron), protected by `CRON_SECRET`. Handles:
1. 24h reminders for upcoming confirmed appointments.
2. 1h reminders for upcoming confirmed appointments.
3. Auto-cancel `pending_payment` appointments older than 30 minutes.
4. Auto-complete `confirmed` appointments whose `ends_at` has passed.

Reminders use **Twilio template messages** (Meta-approved), configured via `TWILIO_TEMPLATE_RECORDATORIO_24H` and `TWILIO_TEMPLATE_RECORDATORIO_1H` env vars. **Reminder timings** (`reminder_timings` array on `barbershops`) are configurable: `24h`, `2h`, or both — read by this cron to decide which reminders to send. The column may not exist in older DB schemas; the code handles its absence gracefully.

## Security notes

- **Twilio webhook signature** is verified in production using HMAC-SHA1 (`timingSafeEqual`); skipped in development. Never disable this check unconditionally.
- **WhatsApp templates** (confirmation and reminders) require Meta/Twilio approval and are read-only in the admin settings UI. To change copy, the CronoCorte team must update and re-approve the template in Twilio before the code can reference it.
