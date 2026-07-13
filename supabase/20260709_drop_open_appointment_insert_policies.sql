-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Cerrar INSERT abierto en appointments + revocar
--            EXECUTE de handle_new_user a PUBLIC
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 09-07-2026
-- ═══════════════════════════════════════════════════════════

-- ── 1. Eliminar policies de INSERT permisivas en appointments ─
-- Ambas policies tenían WITH CHECK (true), permitiendo a anon (y a
-- cualquier rol vía PUBLIC) insertar citas arbitrarias directamente por
-- PostgREST (/rest/v1/appointments): status confirmed sin pagar,
-- total_amount 0, worker/service de otra barbería, etc.
-- El booking real corre en /api/appointments/create con service_role
-- (bypasea RLS), así que ninguna reserva legítima depende de estas policies.
DROP POLICY IF EXISTS "Anon can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "public insert appointment" ON public.appointments;

-- ── 2. Revocar EXECUTE de handle_new_user a PUBLIC ─
-- El hardening anterior revocó a anon/authenticated explícitamente, pero
-- el proacl aún incluía `=X/postgres` (EXECUTE para PUBLIC), del cual
-- anon/authenticated heredan. Por eso el advisor seguía marcando la función
-- como invocable vía /rest/v1/rpc/handle_new_user. Revocamos a PUBLIC para
-- cerrar el hueco por completo. El trigger on_auth_user_created sigue
-- funcionando: corre como SECURITY DEFINER, no depende de este grant.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
