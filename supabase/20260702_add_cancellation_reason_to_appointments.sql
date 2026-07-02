-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: add cancellation reason to appointments
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: julio 2026
-- ═══════════════════════════════════════════════════════════

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
