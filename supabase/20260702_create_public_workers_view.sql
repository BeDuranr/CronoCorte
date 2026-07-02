-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: create public workers view
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: julio 2026
-- ═══════════════════════════════════════════════════════════

-- La policy "public read active workers" permitía que cualquiera con la anon key
-- leyera TODAS las columnas de workers, incluyendo calendar_token y phone.
-- Se reemplaza por una vista que expone solo columnas seguras.

CREATE OR REPLACE VIEW public_workers AS
SELECT id, barbershop_id, name, specialty, avatar_url, is_active
FROM workers;

-- Dar permiso de lectura al rol anon (clientes sin login) y authenticated
GRANT SELECT ON public_workers TO anon, authenticated;

-- Eliminar la policy que daba acceso público a toda la tabla
DROP POLICY IF EXISTS "public read active workers" ON workers;
