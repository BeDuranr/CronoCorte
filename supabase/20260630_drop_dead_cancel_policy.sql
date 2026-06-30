-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: drop dead cancel policy
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: junio 2026
-- ═══════════════════════════════════════════════════════════

-- La policy "cancel by token" usaba current_setting('app.cancel_token') que nunca
-- se seteaba en el código. La cancelación real usa createAdminClient() (service role)
-- que bypasea RLS, así que esta policy era código muerto sin efecto.
DROP POLICY IF EXISTS "cancel by token" ON appointments;
