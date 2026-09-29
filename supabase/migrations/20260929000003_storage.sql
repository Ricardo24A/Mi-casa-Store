-- Fase 1 · Buckets de Storage y sus políticas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Imágenes de productos y categorías: lectura pública por URL, escritura solo admin.
  ('product-images', 'product-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  -- Comprobantes: PRIVADO. El navegador no sube ni lee nada aquí: sube el servidor
  -- (service_role, tras validar el tipo real del archivo) y el admin los ve con URLs firmadas.
  ('payment-proofs', 'payment-proofs', false, 5242880,
   array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- product-images: no hace falta política de lectura (el bucket es público).
create policy product_images_storage_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_storage_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- payment-proofs: solo el admin puede pedir URLs firmadas. Ninguna otra política:
-- el resto de roles no puede listar, leer, subir ni borrar.
create policy payment_proofs_storage_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());
