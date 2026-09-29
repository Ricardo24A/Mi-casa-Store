-- Pruebas de RLS y restricciones. Corre dentro de una transacción y hace ROLLBACK al final,
-- así que no deja datos. Sirve en Supabase (SQL Editor / `supabase test db`) y en el
-- Postgres local de scripts/test-db.sh. Si algo falla, lanza una excepción con el motivo.
begin;

-- ---------------------------------------------------------------------------
-- Datos de prueba (como superusuario)
-- ---------------------------------------------------------------------------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- admin
  ('00000000-0000-0000-0000-0000000000c1'),  -- cliente 1
  ('00000000-0000-0000-0000-0000000000c2');  -- cliente 2

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.categories (id, nombre, slug)
values ('10000000-0000-0000-0000-000000000001', 'Cat test', 'cat-test');

insert into public.products (id, category_id, nombre, slug, precio, stock, activo) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Activo',   'p-activo',   10, 5, true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Inactivo', 'p-inactivo', 10, 5, false);

insert into public.product_images (product_id, url) values
  ('20000000-0000-0000-0000-000000000001', 'a.jpg'),
  ('20000000-0000-0000-0000-000000000002', 'b.jpg');

insert into public.discounts (nombre, tipo, valor, alcance, codigo, inicia, termina) values
  ('Auto vigente', 'porcentaje', 10, 'tienda', null,       now() - interval '1 day', now() + interval '1 day'),
  ('Con cupón',    'porcentaje', 20, 'tienda', 'CUPON20',  now() - interval '1 day', now() + interval '1 day'),
  ('Vencido',      'porcentaje', 30, 'tienda', null,       now() - interval '3 day', now() - interval '2 day');

insert into public.orders (id, user_id, subtotal, descuento, envio, total, vence_en) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 20, 0, 3, 23, now() + interval '2 day'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 10, 0, 0, 10, now() + interval '2 day');

insert into public.order_items (order_id, product_id, nombre, precio_unitario, cantidad) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Activo', 10, 2),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Activo', 10, 1);

insert into public.payment_proofs (order_id, archivo, hash) values
  ('30000000-0000-0000-0000-000000000001', 'c1/a.png', repeat('a', 64)),
  ('30000000-0000-0000-0000-000000000002', 'c2/b.png', repeat('b', 64));

-- ---------------------------------------------------------------------------
-- Restricciones de datos (como superusuario)
-- ---------------------------------------------------------------------------
do $$
declare ref text;
begin
  select referencia into ref from public.orders where id = '30000000-0000-0000-0000-000000000001';
  assert ref ~ '^MC-[A-Z2-9]{8}$', 'la referencia del pedido se genera sola: ' || coalesce(ref, 'null');
  assert (select count(*) from public.profiles) = 3, 'cada usuario nuevo tiene perfil';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'customer',
    'los usuarios nuevos son customer';

  begin
    insert into public.products (category_id, nombre, slug, precio) values ('10000000-0000-0000-0000-000000000001', 'x', 'x1', 0.5);
    raise exception 'debía rechazar precio < 1';
  exception when check_violation then null; end;

  begin
    insert into public.products (category_id, nombre, slug, precio) values ('10000000-0000-0000-0000-000000000001', 'x', 'x2', 101);
    raise exception 'debía rechazar precio > 100';
  exception when check_violation then null; end;

  begin
    insert into public.orders (user_id, subtotal, descuento, envio, total, vence_en)
    values ('00000000-0000-0000-0000-0000000000c1', 10, 0, 0, 99, now());
    raise exception 'debía rechazar total incoherente';
  exception when check_violation then null; end;

  begin
    insert into public.orders (subtotal, total, vence_en) values (10, 10, now());
    raise exception 'debía exigir cliente o invitado';
  exception when check_violation then null; end;

  begin
    insert into public.payment_proofs (order_id, archivo, hash, estado)
    values ('30000000-0000-0000-0000-000000000001', 'x', repeat('c', 64), 'rechazado');
    raise exception 'debía exigir motivo al rechazar';
  exception when check_violation then null; end;

  begin
    insert into public.discounts (nombre, tipo, valor, alcance) values ('x', 'porcentaje', 150, 'tienda');
    raise exception 'debía rechazar porcentaje > 100';
  exception when check_violation then null; end;

  begin
    insert into public.discounts (nombre, tipo, valor, alcance) values ('x', 'monto_fijo', 5, 'producto');
    raise exception 'debía exigir target_id si el alcance no es tienda';
  exception when check_violation then null; end;

  begin
    update public.products set stock_reservado = 99 where slug = 'p-activo';
    raise exception 'la reserva no puede superar el stock';
  exception when check_violation then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- Visitante anónimo
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  assert (select count(*) from public.products) = 1, 'anon solo ve productos activos';
  assert (select count(*) from public.product_images) = 1, 'anon solo ve imágenes de productos activos';
  assert (select count(*) from public.categories) >= 1, 'anon ve categorías';
  assert (select count(*) from public.discounts) = 1, 'anon solo ve descuentos automáticos vigentes (sin cupón)';

  begin
    perform 1 from public.orders;
    raise exception 'anon no debe leer pedidos';
  exception when insufficient_privilege then null; end;

  begin
    perform 1 from public.payment_proofs;
    raise exception 'anon no debe leer comprobantes';
  exception when insufficient_privilege then null; end;

  begin
    perform 1 from public.store_settings;
    raise exception 'anon no debe leer ajustes';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.products (category_id, nombre, slug, precio)
    values ('10000000-0000-0000-0000-000000000001', 'hack', 'hack', 5);
    raise exception 'anon no debe insertar productos';
  exception when insufficient_privilege then null; end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Cliente 1
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

do $$
declare n integer;
begin
  assert (select count(*) from public.orders) = 1, 'el cliente solo ve su pedido';
  assert (select count(*) from public.order_items) = 1, 'el cliente solo ve los ítems de su pedido';
  assert (select count(*) from public.payment_proofs) = 1, 'el cliente solo ve sus comprobantes';
  assert (select count(*) from public.profiles) = 1, 'el cliente solo ve su perfil';
  assert (select count(*) from public.store_settings) = 0, 'el cliente no ve ajustes';
  assert (select count(*) from public.product_templates) = 0, 'el cliente no ve plantillas';
  assert not public.is_admin(), 'un cliente no es admin';

  update public.profiles set full_name = 'Cliente Uno' where id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics n = row_count;
  assert n = 1, 'el cliente puede editar su nombre';

  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'escalada de privilegios: el cliente cambió su rol';
  exception when insufficient_privilege then null; end;

  update public.profiles set full_name = 'Hack' where id = '00000000-0000-0000-0000-0000000000c2';
  get diagnostics n = row_count;
  assert n = 0, 'el cliente no puede editar el perfil de otro';

  update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'el cliente no puede marcar su pedido como pagado';

  update public.payment_proofs set estado = 'aprobado' where order_id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'el cliente no puede aprobar su comprobante';

  begin
    insert into public.orders (user_id, subtotal, total, vence_en)
    values ('00000000-0000-0000-0000-0000000000c1', 1, 0, now());
    raise exception 'el cliente no debe crear pedidos desde el navegador';
  exception when insufficient_privilege or check_violation then null; end;

  begin
    update public.products set precio = 1 where slug = 'p-activo';
    get diagnostics n = row_count;
    assert n = 0, 'el cliente no puede cambiar precios';
  end;

  begin
    delete from public.categories;
    get diagnostics n = row_count;
    assert n = 0, 'el cliente no puede borrar categorías';
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('payment-proofs', 'x.png');
    raise exception 'el cliente no debe subir al bucket de comprobantes';
  exception when insufficient_privilege then null; end;

  begin
    insert into storage.objects (bucket_id, name) values ('product-images', 'x.png');
    raise exception 'el cliente no debe subir imágenes de producto';
  exception when insufficient_privilege then null; end;

  assert (select count(*) from storage.objects where bucket_id = 'payment-proofs') = 0,
    'el cliente no lee el bucket de comprobantes';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Administrador
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare n integer;
begin
  assert public.is_admin(), 'el admin es admin';
  assert (select count(*) from public.orders) = 2, 'el admin ve todos los pedidos';
  assert (select count(*) from public.payment_proofs) = 2, 'el admin ve todos los comprobantes';
  assert (select count(*) from public.products) = 2, 'el admin ve también productos inactivos';
  assert (select count(*) from public.discounts) = 3, 'el admin ve todos los descuentos';
  assert (select count(*) from public.store_settings) = 1, 'el admin ve los ajustes';

  insert into public.products (category_id, nombre, slug, precio)
  values ('10000000-0000-0000-0000-000000000001', 'Nuevo', 'p-nuevo', 15);

  update public.products set precio = 12 where slug = 'p-nuevo';
  get diagnostics n = row_count;
  assert n = 1, 'el admin edita productos';

  update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'el admin cambia el estado del pedido';

  update public.payment_proofs
    set estado = 'rechazado', motivo = 'No coincide el monto', revisado_por = '00000000-0000-0000-0000-0000000000a1'
    where order_id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'el admin revisa comprobantes';

  update public.store_settings set costo_envio = 4;
  get diagnostics n = row_count;
  assert n = 1, 'el admin edita ajustes';

  insert into storage.objects (bucket_id, name) values ('product-images', 'admin.png');

  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'el rol solo se cambia con acceso directo a la base, no desde la API';
  exception when insufficient_privilege then null; end;

  begin
    delete from public.orders;
    raise exception 'ni el admin borra pedidos desde la API';
  exception when insufficient_privilege then null; end;
end $$;

reset role;

rollback;

select 'RLS OK' as resultado;
