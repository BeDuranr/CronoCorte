-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Horarios especiales por fecha (schedule_overrides)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: septiembre 2026
-- ═══════════════════════════════════════════════════════════

-- Excepciones al horario semanal (availability) para una fecha puntual de la
-- barbería completa: Navidad, fiestas patrias, etc. Si existe una fila para
-- una fecha, reemplaza al horario semanal de ese día; si no, manda availability.
--   is_closed = TRUE  → la barbería no atiende ese día
--   is_closed = FALSE → atiende entre start_time y end_time (hora Chile)
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
  start_time    TIME,
  end_time      TIME,
  label         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT schedule_overrides_one_per_date UNIQUE (barbershop_id, date),
  CONSTRAINT schedule_overrides_times_valid CHECK (
    is_closed OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que availability: el admin gestiona lo de su barbería y la
-- lectura es pública (la página de reservas la necesita para el cliente anónimo).
CREATE POLICY "admin manages schedule overrides" ON schedule_overrides
  FOR ALL TO authenticated
  USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  )
  WITH CHECK (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );

CREATE POLICY "public read schedule overrides" ON schedule_overrides
  FOR SELECT USING (TRUE);
