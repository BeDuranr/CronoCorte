-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Color de acento personalizable por barbería
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: Junio 2026
-- ═══════════════════════════════════════════════════════════

ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) DEFAULT '#e63946';
