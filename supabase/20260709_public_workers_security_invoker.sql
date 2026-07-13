-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: public_workers → security_invoker (quita SECURITY DEFINER)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 09-07-2026
-- ═══════════════════════════════════════════════════════════

-- Contexto: el advisor de Supabase marca la vista public_workers como
-- SECURITY DEFINER (nivel ERROR) porque corre con los permisos/RLS del
-- creador, no del que consulta. Pasamos a security_invoker para cerrar el flag.
--
-- Estado previo verificado:
--   • anon YA tiene GRANT SELECT solo sobre las columnas seguras de workers
--     (id, barbershop_id, name, specialty, avatar_url, is_active).
--     NO tiene grant sobre calendar_token ni phone (Crítico #2).
--   • RLS de workers solo tenía policies para admin (su barbería) y worker
--     (su propio registro). anon no podía leer nada por RLS.
--
-- Con security_invoker, la vista pasa a ejecutarse como anon, así que anon
-- necesita una policy SELECT sobre workers. Los GRANT por columna existentes
-- garantizan que anon solo lea columnas seguras; esta policy limita las FILAS
-- a workers activos. Resultado: misma exposición que la vista definer, sin el flag.

-- ── 1. Vista deja de ser SECURITY DEFINER ─
ALTER VIEW public.public_workers SET (security_invoker = on);

-- ── 2. Policy SELECT para anon: solo workers activos ─
-- IMPORTANTE: solo para el rol anon. NO agregar authenticated aquí: ese rol
-- tiene GRANT sobre todas las columnas (incl. calendar_token/phone), y una
-- policy amplia reabriría el leak que cerró el Crítico #2.
DROP POLICY IF EXISTS "anon reads active workers" ON public.workers;
CREATE POLICY "anon reads active workers" ON public.workers
  FOR SELECT
  TO anon
  USING (is_active = true);
