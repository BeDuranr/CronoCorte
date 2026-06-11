-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Mejoras de seguridad
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: Junio 2026
-- ═══════════════════════════════════════════════════════════

-- ── 1. Constraint de exclusión anti-doble reserva ─────────
-- Evita que dos citas del mismo barbero se solapen a nivel de base de datos,
-- cerrando la condición de carrera que existe cuando dos requests
-- pasan el check-then-insert casi simultáneamente.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT IF NOT EXISTS no_double_booking
  EXCLUDE USING gist (
    worker_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status <> 'cancelled');

-- ── 2. Restringir columnas visibles de workers al rol anon ─
-- La policy "public read active workers" no restringe columnas:
-- calendar_token (permite descargar agendas completas con datos de clientes)
-- y phone quedan expuestos a cualquier consulta anónima.
-- Solución: revocar acceso de tabla completa y re-otorgar solo columnas seguras.
REVOKE SELECT ON workers FROM anon;
GRANT SELECT (id, barbershop_id, name, specialty, is_active) ON workers TO anon;
-- Si tu columna de foto se llama avatar_url, agrégala:
-- GRANT SELECT (avatar_url) ON workers TO anon;
-- Si se llama photo_url:
-- GRANT SELECT (photo_url) ON workers TO anon;

-- ── 3. Eliminar policy muerta "cancel by token" ────────────
-- El endpoint de cancelación usa service_role (admin client), que bypasea RLS.
-- current_setting('app.cancel_token') nunca se setea desde el código,
-- por lo que esta policy es letra muerta y solo genera confusión.
DROP POLICY IF EXISTS "cancel by token" ON appointments;
