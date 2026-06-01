-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Reservas grupales (varias personas, un solo pago)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: Junio 2026
-- ═══════════════════════════════════════════════════════════

-- Agrupa varias citas que se reservan y pagan juntas.
-- Cada persona del grupo = una fila en appointments con el mismo booking_group_id.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS booking_group_id UUID;

-- Monto total del grupo (suma de todos los servicios de todas las personas).
-- La verificación de pago compara el comprobante contra este monto.
-- Para reservas de 1 sola persona también se llena (= precio de sus servicios).
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);

-- Índice para buscar y actualizar todo un grupo de una vez.
CREATE INDEX IF NOT EXISTS idx_appointments_booking_group
  ON appointments(booking_group_id);

-- ───────────────────────────────────────────────────────────
-- Notas:
-- • Citas existentes quedan con booking_group_id = NULL (reservas individuales
--   antiguas) y total_amount = NULL. El código las maneja con fallback al
--   precio del servicio, así que no se rompe nada.
-- • cancel_token sigue siendo compartido: todas las citas de un grupo llevan
--   el mismo token, de modo que un solo link cancela el grupo completo.
-- ───────────────────────────────────────────────────────────
