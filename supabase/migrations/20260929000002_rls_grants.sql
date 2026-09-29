-- Fase 1 · RLS y permisos.
--
-- El proyecto tiene desactivado "Automatically expose new tables": ninguna tabla nueva
-- recibe permisos por defecto, así que aquí se concede explícitamente lo mínimo.
-- Dos capas: GRANT (¿puede el rol tocar la tabla/columna?) y RLS (¿qué filas?).
--
--   anon          → solo lectura del catálogo público.
--   authenticated → lo anterior + lo suyo (pedidos, comprobantes); el admin además escribe
--                   catálogo, ajustes y revisión de pagos (política is_admin()).
--   service_role  → el servidor de Next.js: crea pedidos y comprobantes, valida cupones y
--                   lee las cuentas bancarias. Se salta RLS, pero necesita GRANT.

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

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated, service_role;
-- La llama el trigger orders_set_reference cuando el servidor (service_role) inserta un pedido.
grant execute on function public.generate_order_reference() to service_role;

-- ---------------------------------------------------------------------------
-- Activar RLS (explícito, aunque el proyecto ya lo active automáticamente)
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
-- GRANTs
-- ---------------------------------------------------------------------------
grant all on
  public.profiles, public.categories, public.product_templates, public.products,
  public.product_images, public.discounts, public.orders, public.order_items,
  public.payment_proofs, public.store_settings
to service_role;

-- Catálogo público
grant select on public.categories, public.products, public.product_images, public.discounts
  to anon, authenticated;

-- Escritura del catálogo: el GRANT lo abre a 'authenticated', la política solo deja pasar al admin.
grant insert, update, delete on
  public.categories, public.products, public.product_images, public.discounts,
  public.product_templates
to authenticated;
grant select on public.product_templates to authenticated;

-- Perfil: cada quien cambia solo su nombre y teléfono, nunca su rol.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Pedidos y comprobantes: lectura propia; el admin solo actualiza estado/revisión.
-- No hay INSERT ni DELETE para authenticated: los pedidos los crea el servidor.
grant select on public.orders, public.order_items, public.payment_proofs to authenticated;
grant update (estado, notas) on public.orders to authenticated;
grant update (estado, motivo, revisado_por, revisado_en) on public.payment_proofs to authenticated;

-- Ajustes: solo admin (las cuentas bancarias se muestran al comprador desde el servidor).
grant select, update on public.store_settings to authenticated;

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

-- Público: solo descuentos automáticos (sin cupón) y vigentes. Los cupones no se listan;
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
-- Pedidos y comprobantes
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
-- Ajustes de la tienda
-- ---------------------------------------------------------------------------
create policy store_settings_admin_select on public.store_settings
  for select to authenticated using (public.is_admin());
create policy store_settings_admin_update on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
