-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Policies RLS + constraint de exclusión para blocked_slots
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: julio 2026
-- ═══════════════════════════════════════════════════════════

-- La tabla blocked_slots existe desde la migración inicial (schema.sql)
-- pero tiene RLS activado sin ninguna policy, así que hasta ahora era
-- inaccesible incluso para el admin. El feature de "bloquear horario"
-- nunca la usó — en su lugar insertaba filas en appointments con
-- status: 'blocked', un valor que no existe en el enum appointment_status,
-- por lo que el insert fallaba siempre. Esta migración habilita el uso
-- real de blocked_slots, con el mismo patrón de policies que ya usa
-- availability (worker gestiona lo propio, admin gestiona todo lo de su
-- barbería).

-- ── 1. Worker gestiona sus propios bloqueos ─
CREATE POLICY "worker manages own blocked slots" ON blocked_slots
  FOR ALL USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );

-- ── 2. Admin gestiona los bloqueos de cualquier worker de su barbería ─
CREATE POLICY "admin manages blocked slots" ON blocked_slots
  FOR ALL USING (
    worker_id IN (
      SELECT id FROM workers WHERE barbershop_id IN (
        SELECT id FROM barbershops WHERE admin_id = auth.uid()
      )
    )
  );

-- ── 3. Evitar bloqueos solapados del mismo worker ─
-- Mismo patrón que no_double_booking en appointments (schema.sql), usando
-- btree_gist (ya habilitado en el proyecto).
ALTER TABLE blocked_slots
  ADD CONSTRAINT no_overlapping_blocks
  EXCLUDE USING gist (
    worker_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  );
