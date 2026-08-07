# Barberos, acceso y configuración de la barbería

## Barberos y acceso

- **Worker invitation**: admin calls `/api/workers/invite` → Supabase sends invite email → worker clicks link → `/accept-invite` page sets password and links `user_profiles` to the worker record. The invite redirects to `NEXT_PUBLIC_APP_URL/accept-invite`.
- **Worker role is read-only for their own data**: workers access `/agenda` (their own appointments). Admins access `/dashboard/**` (full management).
- **Barbershop name is immutable** from the settings UI — the field is disabled. Name changes require a direct DB update (the slug is derived from the name at creation time and is also immutable once set).

## Configuración de la barbería

- **Accent color** applies only to the public booking page (`/[slug]`). The admin dashboard always uses `#e63946`. Preset options: `#e63946`, `#3563d8`, `#3a9b6c`, `#8a56c9`, `#444444`, or any custom hex. The color is injected as CSS variables `--red`, `--red-dark`, `--red-light` at render time.
- **Transfer info format**: written as `"Label: Valor"` one per line. The booking success screen parses this to render per-field copy buttons. Lines without a colon are shown as plain text without a copy button.
- **WhatsApp templates** (confirmation and reminders) require Meta/Twilio approval. Admins cannot edit them directly; they are read-only in the settings UI. To change them, the CronoCorte team must update and re-approve the templates in Twilio.
- **Reminder timings** (`reminder_timings` array on `barbershops`) are configurable: `24h`, `2h`, or both. The cron job at `/api/cron/reminders` reads this field to decide which reminders to send. Columns `cancel_policy`, `reminder_timings`, `whatsapp_template_confirmed`, and `whatsapp_template_reminder` may not exist in older DB schemas — the config page handles their absence gracefully.
