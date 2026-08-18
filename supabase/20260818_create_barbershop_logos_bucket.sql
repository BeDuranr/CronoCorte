-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Bucket de Storage para logos de barbería
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: Agosto 2026
-- ═══════════════════════════════════════════════════════════

-- Bucket público de lectura (el logo se muestra en la página pública de
-- reservas y en la historia de Instagram, ambas sin autenticación). Solo el
-- admin dueño de la barbería puede subir/actualizar/borrar su propio logo.
-- Convención de path: {barbershop_id}/logo.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barbershop-logos',
  'barbershop-logos',
  true,
  2097152, -- 2MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Lectura pública
create policy "barbershop_logos_public_read"
on storage.objects for select
using (bucket_id = 'barbershop-logos');

-- Solo el admin dueño de la barbería puede subir a su propia carpeta
create policy "barbershop_logos_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'barbershop-logos'
  and exists (
    select 1 from public.barbershops b
    where b.id::text = (storage.foldername(name))[1]
    and b.admin_id = auth.uid()
  )
);

create policy "barbershop_logos_owner_update"
on storage.objects for update
using (
  bucket_id = 'barbershop-logos'
  and exists (
    select 1 from public.barbershops b
    where b.id::text = (storage.foldername(name))[1]
    and b.admin_id = auth.uid()
  )
);

create policy "barbershop_logos_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'barbershop-logos'
  and exists (
    select 1 from public.barbershops b
    where b.id::text = (storage.foldername(name))[1]
    and b.admin_id = auth.uid()
  )
);
