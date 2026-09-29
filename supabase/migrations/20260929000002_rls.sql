-- Fase 1 · Seguridad a nivel de fila (RLS), permisos y buckets de Storage.
--
-- Modelo:
--   * anon / authenticated: solo lo que las políticas permiten.
--   * admin (profiles.role = 'admin'): escribe catálogo, ajustes y revisión de pagos.
--   * Pedidos y comprobantes NUNCA se crean desde el navegador: los crea el servidor
--     con la clave service_role (que se salta RLS) después de validar y recalcular totales.

-- ---------------------------------------------------------------------------
-- Helper de rol
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Las funciones internas no deben poder llamarse desde la API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.generate_order_reference() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos base: se quita todo y se concede lo mínimo (RLS decide las filas)
-- ---------------------------------------------------------------------------
revoke all on
  public.profiles, public.categories, public.product_templates, public.products,
  public.product_images, public.discounts, public.orders, public.order_items,
  public.payment_proofs, public.store_settings
from anon, authenticated;

-- Catálogo público (lectura); escritura solo pasa si la política confirma admin.
grant select on public.categories, public.products, public.product_images, public.discounts
  to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images,
  public.discounts, public.product_templates to authenticated;
grant select on public.product_templates to authenticated;

grant select on public.profiles to authenticated;
-- El usuario solo puede cambiar su nombre y teléfono; nunca su rol.
grant update (full_name, phone) on public.profiles to authenticated;

grant select on public.orders, public.order_items, public.payment_proofs to authenticated;
grant update (estado, notas) on public.orders to authenticated;
grant update (estado, motivo, revisado_por, revisado_en) on public.payment_proofs to authenticated;

grant select, update on public.store_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Activar RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.product_templates enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.discounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.store_settings enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create policy categories_select on public.categories
  for select to anon, authenticated using (true);
create policy categories_admin_insert on public.categories
  for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.categories
  for delete to authenticated using (public.is_admin());

create policy product_templates_admin_select on public.product_templates
  for select to authenticated using (public.is_admin());
create policy product_templates_admin_insert on public.product_templates
  for insert to authenticated with check (public.is_admin());
create policy product_templates_admin_update on public.product_templates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_templates_admin_delete on public.product_templates
  for delete to authenticated using (public.is_admin());

create policy products_select on public.products
  for select to anon, authenticated using (activo or public.is_admin());
create policy products_admin_insert on public.products
  for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products
  for delete to authenticated using (public.is_admin());

create policy product_images_select on public.product_images
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.activo
    )
  );
create policy product_images_admin_insert on public.product_images
  for insert to authenticated with check (public.is_admin());
create policy product_images_admin_update on public.product_images
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_admin_delete on public.product_images
  for delete to authenticated using (public.is_admin());

-- Público: solo descuentos automáticos (sin cupón) y vigentes. Los cupones no se listan:
-- el servidor los valida con service_role.
create policy discounts_select on public.discounts
  for select to anon, authenticated
  using (
    public.is_admin()
    or (
      activo
      and codigo is null
      and inicia <= now()
      and (termina is null or termina > now())
    )
  );
create policy discounts_admin_insert on public.discounts
  for insert to authenticated with check (public.is_admin());
create policy discounts_admin_update on public.discounts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy discounts_admin_delete on public.discounts
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Pedidos y comprobantes: el cliente solo lee lo suyo; el admin lee y revisa.
-- No hay políticas de INSERT/DELETE: solo el servidor (service_role) crea pedidos.
-- ---------------------------------------------------------------------------
create policy orders_select on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy orders_admin_update on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy order_items_select on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = (select auth.uid()) or public.is_admin())
    )
  );

create policy payment_proofs_select on public.payment_proofs
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payment_proofs.order_id
        and (o.user_id = (select auth.uid()) or public.is_admin())
    )
  );
create policy payment_proofs_admin_update on public.payment_proofs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Ajustes de la tienda: solo admin. (Las cuentas bancarias se muestran al comprador
-- desde el servidor, en la pantalla de pago.)
-- ---------------------------------------------------------------------------
create policy store_settings_admin_select on public.store_settings
  for select to authenticated using (public.is_admin());
create policy store_settings_admin_update on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Imágenes de productos: lectura pública, escritura solo admin.
  ('product-images', 'product-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  -- Comprobantes: privado. El navegador nunca lo toca; el servidor sube con service_role
  -- y el admin los ve mediante URLs firmadas temporales.
  ('payment-proofs', 'payment-proofs', false, 5242880,
   array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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

-- Solo el admin puede pedir URLs firmadas de comprobantes.
create policy payment_proofs_storage_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());
