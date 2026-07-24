-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar slot_interval_minutes a barbershops
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: julio 2026
-- ═══════════════════════════════════════════════════════════

-- Granularidad de los horarios ofrecidos al reservar (en minutos). Algunas
-- barberías agendan cada 60 min, otras cada 30 min. Antes estaba hardcodeado
-- a 60 en calculateAvailableSlots.
ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE barbershops
  ADD CONSTRAINT slot_interval_minutes_valid CHECK (slot_interval_minutes IN (15, 30, 60));
