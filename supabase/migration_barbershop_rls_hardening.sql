-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Hardening RLS de barbershops + registro server-side
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: Julio 2026
-- ═══════════════════════════════════════════════════════════

-- ── 1. Eliminar policy de INSERT redundante en barbershops ─
-- La creación de barberías ahora ocurre server-side en /api/auth/register
-- con service_role (bypasea RLS). Esta policy con WITH CHECK (true) permitía
-- que CUALQUIER usuario autenticado (incluido un barbero) insertara filas de
-- barbería arbitrarias vía PostgREST. Al eliminarla se cierra ese hueco.
-- La policy "admin owns barbershop" (ALL, admin_id = auth.uid()) sigue cubriendo
-- update/delete/select del dueño, y la lectura pública por slug queda intacta.
DROP POLICY IF EXISTS "Authenticated users can create barbershop" ON public.barbershops;

-- ── 2. Revocar EXECUTE de handle_new_user a roles públicos ─
-- Es una función SECURITY DEFINER usada solo como trigger on_auth_user_created.
-- Al vivir en el schema public queda expuesta como RPC en
-- /rest/v1/rpc/handle_new_user para anon/authenticated. No debería ser
-- invocable directamente; revocamos el EXECUTE (el trigger sigue funcionando,
-- corre como owner de la tabla, no depende de estos grants).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
