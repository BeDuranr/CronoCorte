-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Corregir políticas del bucket barbershop-logos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: Agosto 2026
-- ═══════════════════════════════════════════════════════════

-- Bug en 20260818_create_barbershop_logos_bucket.sql: dentro del EXISTS,
-- la referencia a "name" quedaba ambigua entre storage.objects.name (el
-- path del archivo, lo que se quería) y barbershops.name (el nombre del
-- negocio, porque la tabla también se llama "b" pero tiene una columna
-- "name"). Postgres resolvía "name" contra la tabla del EXISTS en vez de
-- la tabla externa, así que storage.foldername(name) partía el NOMBRE DEL
-- NEGOCIO en vez del path — nunca había match y la política rechazaba
-- todas las subidas, incluso las del dueño legítimo.
--
-- Fix: calificar explícitamente storage.objects.name.

drop policy if exists "barbershop_logos_owner_insert" on storage.objects;
drop policy if exists "barbershop_logos_owner_update" on storage.objects;
drop policy if exists "barbershop_logos_owner_delete" on storage.objects;

create policy "barbershop_logos_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'barbershop-logos'
  and exists (
    select 1 from public.barbershops b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
    and b.admin_id = auth.uid()
  )
);

create policy "barbershop_logos_owner_update"
on storage.objects for update
using (
  bucket_id = 'barbershop-logos'
  and exists (
    select 1 from public.barbershops b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
    and b.admin_id = auth.uid()
  )
);

create policy "barbershop_logos_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'barbershop-logos'
  and exists (
    select 1 from public.barbershops b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
    and b.admin_id = auth.uid()
  )
);
