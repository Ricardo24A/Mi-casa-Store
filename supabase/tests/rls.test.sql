-- Pruebas de RLS, permisos y restricciones.
-- Corre dentro de una transacción y termina con ROLLBACK: no deja datos.
-- Ejecutar SOLO en un proyecto de desarrollo/staging (SQL Editor o `supabase test db`),
-- después de aplicar las migraciones. Si algo falla, lanza una excepción con el motivo;
-- si todo pasa, devuelve 'RLS OK'.
begin;

-- ---------------------------------------------------------------------------
-- Línea base: lo que ya hay en la base antes de insertar los datos de prueba.
-- Las aserciones comparan contra estos valores (antes + lo insertado), así las pruebas
-- funcionan también con pedidos y descuentos reales. Se guardan en variables de sesión
-- (set_config) porque las leen roles distintos y una tabla temporal no.
-- ---------------------------------------------------------------------------
select
  set_config('t.orders',        (select count(*) from public.orders)::text, true),
  set_config('t.proofs',        (select count(*) from public.payment_proofs)::text, true),
  set_config('t.discounts',     (select count(*) from public.discounts)::text, true),
  -- descuentos que ve un visitante: automáticos (sin cupón) y vigentes
  set_config('t.discounts_pub', (select count(*) from public.discounts
                                 where activo and codigo is null and inicia <= now()
                                   and (termina is null or termina > now()))::text, true);

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
  ('Auto vigente', 'porcentaje', 10, 'tienda', null,      now() - interval '1 day', now() + interval '1 day'),
  ('Con cupón',    'porcentaje', 20, 'tienda', 'TESTCUP20', now() - interval '1 day', now() + interval '1 day'),
  ('Vencido',      'porcentaje', 30, 'tienda', null,      now() - interval '3 day', now() - interval '2 day');

insert into public.orders
  (id, user_id, contacto_nombre, contacto_email, contacto_telefono, subtotal, descuento, descuento_transferencia, envio, total, vence_en)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 20, 0, 1, 3, 22, now() + interval '2 day'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 'C2', 'c2@test.ec', '0999999992', 10, 0, 0, 0, 10, now() + interval '2 day');

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
  assert (select count(*) from public.profiles) >= 3, 'cada usuario nuevo tiene perfil';
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'customer',
    'los usuarios nuevos son customer';

  -- El precio es libre: cualquier valor mayor que 0
  insert into public.products (category_id, nombre, slug, precio)
  values ('10000000-0000-0000-0000-000000000001', 'Barato', 'p-barato', 0.25),
         ('10000000-0000-0000-0000-000000000001', 'Caro',   'p-caro',   450);

  begin
    insert into public.products (category_id, nombre, slug, precio)
    values ('10000000-0000-0000-0000-000000000001', 'x', 'x0', 0);
    raise exception 'debía rechazar precio 0';
  exception when check_violation then null; end;

  begin
    insert into public.orders (contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
    values ('X', 'x@x.ec', '0999999999', 10, 99, now());
    raise exception 'debía rechazar total incoherente';
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

  -- Comprobante obligatorio
  insert into public.orders
    (id, contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
  values ('30000000-0000-0000-0000-000000000003', 'Invitado', 'g@test.ec', '0999999993', 10, 10, now() + interval '1 day');

  begin
    update public.orders set estado = 'comprobante_recibido' where id = '30000000-0000-0000-0000-000000000003';
    raise exception 'debía exigir comprobante para pasar a comprobante_recibido';
  exception when check_violation then null; end;

  insert into public.payment_proofs (order_id, archivo, hash)
  values ('30000000-0000-0000-0000-000000000003', 'g/a.png', repeat('d', 64));
  update public.orders set estado = 'comprobante_recibido' where id = '30000000-0000-0000-0000-000000000003';

  begin
    update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-000000000003';
    raise exception 'debía exigir comprobante aprobado para pasar a pagado';
  exception when check_violation then null; end;

  update public.payment_proofs set estado = 'aprobado' where order_id = '30000000-0000-0000-0000-000000000003';
  update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-000000000003';
end $$;

-- ---------------------------------------------------------------------------
-- Visitante anónimo
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  assert (select count(*) from public.products where slug in ('p-activo', 'p-barato', 'p-caro')) = 3,
    'anon solo ve productos activos (activo, barato, caro)';
  assert (select count(*) from public.products where not activo) = 0, 'anon no ve inactivos';
  assert (select count(*) from public.products where slug = 'p-inactivo') = 0, 'anon no ve el producto inactivo de prueba';
  assert (select count(*) from public.product_images where url in ('a.jpg', 'b.jpg')) = 1, 'anon solo ve imágenes de productos activos';
  -- antes + 1: solo 'Auto vigente' suma; el cupón y el vencido no se ven
  assert (select count(*) from public.discounts) = current_setting('t.discounts_pub')::integer + 1,
    'anon solo ve descuentos automáticos vigentes (sin cupón)';

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
    perform 1 from public.profiles;
    raise exception 'anon no debe leer perfiles';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.products (category_id, nombre, slug, precio)
    values ('10000000-0000-0000-0000-000000000001', 'hack', 'hack', 5);
    raise exception 'anon no debe insertar productos';
  exception when insufficient_privilege then null; end;

  begin
    perform public.generate_order_reference();
    raise exception 'anon no debe ejecutar generate_order_reference()';
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
    insert into public.orders (contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
    values ('X', 'x@x.ec', '0999999999', 1, 1, now());
    raise exception 'el cliente no debe crear pedidos desde el navegador';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.payment_proofs (order_id, archivo, hash)
    values ('30000000-0000-0000-0000-000000000001', 'x', repeat('e', 64));
    raise exception 'el cliente no debe crear comprobantes desde el navegador';
  exception when insufficient_privilege then null; end;

  update public.products set precio = 1 where slug = 'p-activo';
  get diagnostics n = row_count;
  assert n = 0, 'el cliente no puede cambiar precios';

  delete from public.categories;
  get diagnostics n = row_count;
  assert n = 0, 'el cliente no puede borrar categorías';

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
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);

do $$
declare n integer;
begin
  assert public.is_admin(), 'el admin es admin';
  assert (select count(*) from public.orders) = current_setting('t.orders')::integer + 3, 'el admin ve todos los pedidos';
  assert (select count(*) from public.payment_proofs) = current_setting('t.proofs')::integer + 3, 'el admin ve todos los comprobantes';
  assert (select count(*) from public.products where slug = 'p-inactivo') = 1, 'el admin ve también productos inactivos';
  assert (select count(*) from public.discounts) = current_setting('t.discounts')::integer + 3, 'el admin ve todos los descuentos';
  assert (select count(*) from public.store_settings) = 1, 'el admin ve los ajustes';
  assert (select umbral_stock_bajo from public.store_settings) = 5, 'el umbral de poco stock arranca en 5';
  assert (select enlaces_redes from public.store_settings) = '{}'::jsonb, 'sin enlaces de redes al inicio';

  insert into public.products (category_id, nombre, slug, precio)
  values ('10000000-0000-0000-0000-000000000001', 'Nuevo', 'p-nuevo', 15);

  update public.products set precio = 12 where slug = 'p-nuevo';
  get diagnostics n = row_count;
  assert n = 1, 'el admin edita productos';

  update public.payment_proofs
    set estado = 'rechazado', motivo = 'No coincide el monto',
        revisado_por = '00000000-0000-0000-0000-0000000000a1', revisado_en = now()
    where order_id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'el admin revisa comprobantes';

  update public.orders set estado = 'rechazado' where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'el admin cambia el estado del pedido';

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

-- ---------------------------------------------------------------------------
-- Administrador sin segundo factor (aal1 o sin claim): no es admin para RLS
-- ---------------------------------------------------------------------------
-- Se prueban los dos casos: sesión de contraseña (aal1) y token sin claim `aal`.
do $$
declare claims text; n integer;
begin
  foreach claims in array array[
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}'
  ] loop
    perform set_config('request.jwt.claims', claims, true);
    set local role authenticated;

    assert not public.is_admin(), 'un admin sin aal2 no es admin: ' || claims;
    -- El proxy necesita leer su propio perfil para decidir entre enrolar y verificar
    assert (select count(*) from public.profiles) = 1,
      'un admin sin aal2 ve solo su propia fila de profiles';
    assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'admin',
      'un admin sin aal2 puede leer su propio rol';
    assert (select count(*) from public.orders) = 0, 'un admin sin aal2 no ve pedidos';
    assert (select count(*) from public.payment_proofs) = 0, 'un admin sin aal2 no ve comprobantes';
    assert (select count(*) from public.store_settings) = 0, 'un admin sin aal2 no ve ajustes';
    assert (select count(*) from public.products where slug = 'p-inactivo') = 0,
      'un admin sin aal2 no ve productos inactivos';

    update public.store_settings set costo_envio = 99;
    get diagnostics n = row_count;
    assert n = 0, 'un admin sin aal2 no edita ajustes';

    begin
      insert into public.categories (nombre, slug) values ('x-aal1', 'x-aal1');
      raise exception 'un admin sin aal2 no debe poder escribir categorías';
    exception when insufficient_privilege then null; end;

    begin
      insert into storage.objects (bucket_id, name) values ('product-images', 'aal1.png');
      raise exception 'un admin sin aal2 no debe poder subir imágenes';
    exception when insufficient_privilege then null; end;

    reset role;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Servidor (service_role): crea pedidos y comprobantes
-- ---------------------------------------------------------------------------
set local role service_role;

do $$
declare ref text;
begin
  -- Sin 'referencia': la genera el trigger, que llama a generate_order_reference()
  insert into public.orders
    (contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
  values ('Srv', 's@test.ec', '0999999994', 5, 5, now() + interval '1 day')
  returning referencia into ref;
  assert ref ~ '^MC-[A-Z2-9]{8}$', 'service_role inserta un pedido y la referencia se genera sola: ' || coalesce(ref, 'null');
  assert (select count(*) from public.store_settings) = 1, 'service_role lee ajustes';
  assert (select count(*) from public.discounts where codigo = 'TESTCUP20') = 1, 'service_role valida cupones';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Visibilidad de categorías (vista visible_categories)
-- ---------------------------------------------------------------------------
-- Categoría con dos subcategorías; solo 'vis-hija' recibe un producto.
insert into public.categories (id, parent_id, nombre, slug) values
  ('10000000-0000-0000-0000-0000000000f1', null,                                   'Vis padre',       'vis-padre'),
  ('10000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000f1', 'Vis hija',        'vis-hija'),
  ('10000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-0000000000f1', 'Vis hija vacía',  'vis-hija-vacia');

-- Empieza INACTIVO
insert into public.products (id, category_id, nombre, slug, precio, stock, activo)
values ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f2',
        'Vis producto', 'vis-producto', 5, 3, false);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  assert (select count(*) from public.visible_categories
          where slug in ('vis-padre', 'vis-hija', 'vis-hija-vacia')) = 0,
    'sin productos activos no aparece ni la categoría ni sus subcategorías';
  assert (select count(*) from public.visible_categories where slug = 'cat-test') = 0,
    'una categoría sin subcategorías con productos no aparece';
end $$;

reset role;

-- Se ACTIVA el producto: aparecen la subcategoría con producto y su categoría, no la vacía
update public.products set activo = true where id = '20000000-0000-0000-0000-0000000000f1';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  assert (select count(*) from public.visible_categories where slug = 'vis-padre') = 1,
    'al activar un producto aparece su categoría';
  assert (select count(*) from public.visible_categories where slug = 'vis-hija') = 1,
    'al activar un producto aparece su subcategoría';
  assert (select count(*) from public.visible_categories where slug = 'vis-hija-vacia') = 0,
    'la subcategoría sin productos sigue oculta aunque su categoría sea visible';
  assert (select parent_id from public.visible_categories where slug = 'vis-hija')
         = '10000000-0000-0000-0000-0000000000f1', 'la vista conserva parent_id';
end $$;

reset role;

-- Agotado (stock 0) pero activo: sigue visible
update public.products set stock = 0 where id = '20000000-0000-0000-0000-0000000000f1';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

do $$
begin
  assert (select count(*) from public.visible_categories where slug in ('vis-padre', 'vis-hija')) = 2,
    'un producto agotado pero activo mantiene visibles su categoría y subcategoría (cliente)';
end $$;

reset role;

-- Se DESACTIVA: desaparecen para todos, incluido el admin (aunque él vea el producto inactivo)
update public.products set activo = false where id = '20000000-0000-0000-0000-0000000000f1';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);

do $$
begin
  assert public.is_admin(), 'el usuario de la prueba es admin';
  assert (select count(*) from public.products where slug = 'vis-producto') = 1,
    'el admin sigue viendo el producto inactivo en products';
  assert (select count(*) from public.visible_categories where slug in ('vis-padre', 'vis-hija')) = 0,
    'un producto inactivo no hace visible la categoría, ni siquiera para el admin';

  begin
    insert into public.visible_categories (nombre, slug) values ('x', 'x');
    raise exception 'la vista no debe ser escribible desde la API';
  exception when insufficient_privilege then null; end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Cuentas de clientes: el rol nunca viene del cliente
-- ---------------------------------------------------------------------------
-- Un registro que intenta colarse como admin desde raw_user_meta_data sigue siendo customer.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', '{"role":"admin","full_name":"  Ana Prueba  "}'),
  ('00000000-0000-0000-0000-0000000000d2', '{"role":"admin","full_name":""}');

do $$
begin
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000d1') = 'customer',
    'el rol del registro no sale de raw_user_meta_data';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d1') = 'Ana Prueba',
    'el nombre del registro se copia recortado';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d2') is null,
    'un nombre vacío queda en null';
end $$;

-- Direcciones: cada cliente ve y edita solo las suyas
insert into public.customer_addresses (user_id, etiqueta, destinatario, telefono, provincia, ciudad, direccion, es_predeterminada) values
  ('00000000-0000-0000-0000-0000000000c1', 'Casa', 'C1', '0999999991', 'Pichincha', 'Quito', 'Av. Siempre Viva 123', true),
  ('00000000-0000-0000-0000-0000000000c2', 'Casa', 'C2', '0999999992', 'Guayas', 'Guayaquil', 'Calle Falsa 456', true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

do $$
declare n integer;
begin
  assert (select count(*) from public.customer_addresses) = 1, 'el cliente solo ve sus direcciones';

  update public.customer_addresses set etiqueta = 'Casa 2' where user_id = '00000000-0000-0000-0000-0000000000c2';
  get diagnostics n = row_count;
  assert n = 0, 'el cliente no edita direcciones ajenas';

  begin
    insert into public.customer_addresses (user_id, etiqueta, destinatario, telefono, provincia, ciudad, direccion)
    values ('00000000-0000-0000-0000-0000000000c2', 'X', 'X', '0999999999', 'Guayas', 'Guayaquil', 'Calle 12345');
    raise exception 'no debe poder crear una dirección a nombre de otro';
  exception when insufficient_privilege then null; end;

  -- Marcar otra como predeterminada quita la marca de la anterior
  insert into public.customer_addresses (user_id, etiqueta, destinatario, telefono, provincia, ciudad, direccion, es_predeterminada)
  values ('00000000-0000-0000-0000-0000000000c1', 'Trabajo', 'C1', '0999999991', 'Pichincha', 'Quito', 'Av. Oficina 99', true);
  assert (select count(*) from public.customer_addresses where es_predeterminada) = 1,
    'solo una dirección predeterminada';
  assert (select etiqueta from public.customer_addresses where es_predeterminada) = 'Trabajo',
    'la última marcada es la predeterminada';

  -- Máximo 10 direcciones (ya tiene 2)
  for i in 1..8 loop
    insert into public.customer_addresses (user_id, etiqueta, destinatario, telefono, provincia, ciudad, direccion)
    values ('00000000-0000-0000-0000-0000000000c1', 'Extra ' || i, 'C1', '0999999991', 'Pichincha', 'Quito', 'Calle extra ' || i);
  end loop;
  begin
    insert into public.customer_addresses (user_id, etiqueta, destinatario, telefono, provincia, ciudad, direccion)
    values ('00000000-0000-0000-0000-0000000000c1', 'Once', 'C1', '0999999991', 'Pichincha', 'Quito', 'Calle once 11');
    raise exception 'el límite de 10 direcciones no se aplicó';
  exception when check_violation then null; end;

  -- El rol sigue sin poder cambiarse desde la API
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'un cliente no debe poder volverse admin';
  exception when insufficient_privilege then null; end;
end $$;

reset role;

-- El visitante anónimo no puede leer direcciones
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.customer_addresses;
    raise exception 'anon no debe leer direcciones';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- create_order: pedido atómico con cuenta obligatoria y stock apartado
-- ---------------------------------------------------------------------------
-- Solo el servidor (service_role) la ejecuta; ni anon ni un usuario autenticado.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
      '{}'::jsonb, '[]'::jsonb, 10, 0, 0, 0, 10, 48);
    raise exception 'un usuario autenticado no debe ejecutar create_order';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.create_order(null, 'X', 'x@test.ec', '0999999999', '{}'::jsonb, '[]'::jsonb, 10, 0, 0, 0, 10, 48);
    raise exception 'anon no debe ejecutar create_order';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare
  o record;
  reservado_antes integer;
  item text := '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":2}]';
begin
  select stock_reservado into reservado_antes from public.products where id = '20000000-0000-0000-0000-000000000001';

  -- Sin usuario: se rechaza aunque el servidor lo intente
  begin
    perform public.create_order(null, 'X', 'x@test.ec', '0999999999', '{}'::jsonb, item::jsonb, 20, 0, 0, 0, 20, 48);
    raise exception 'un pedido sin usuario debe rechazarse';
  exception when raise_exception then
    assert sqlerrm = 'cuenta_requerida', 'motivo del rechazo sin usuario: ' || sqlerrm;
  end;

  -- Pedido válido: guarda el usuario, aparta el stock y crea las líneas
  select * into o from public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
    '{"ciudad":"Quito"}'::jsonb, item::jsonb, 20, 0, 1, 3, 22, 48);
  assert o.o_referencia ~ '^MC-[A-Z2-9]{8}$', 'el pedido recibe su referencia';
  assert (select user_id from public.orders where id = o.o_id) = '00000000-0000-0000-0000-0000000000c1',
    'el pedido guarda el user_id';
  assert (select estado from public.orders where id = o.o_id) = 'pendiente_pago', 'nace pendiente de pago';
  assert (select count(*) from public.order_items where order_id = o.o_id) = 1, 'crea sus líneas';
  assert (select stock_reservado from public.products where id = '20000000-0000-0000-0000-000000000001') = reservado_antes + 2,
    'aparta el stock';

  -- Más de lo disponible: se rechaza y no aparta nada
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
      '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":100}]'::jsonb,
      1000, 0, 0, 0, 1000, 48);
    raise exception 'no debe vender más de lo disponible';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'motivo del rechazo por stock: ' || sqlerrm;
  end;
  assert (select stock_reservado from public.products where id = '20000000-0000-0000-0000-000000000001') = reservado_antes + 2,
    'un pedido rechazado no deja stock apartado';

  -- Producto inactivo: no se vende
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
      '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-000000000002","nombre":"Inactivo","precio_unitario":10,"cantidad":1}]'::jsonb,
      10, 0, 0, 0, 10, 48);
    raise exception 'no debe vender un producto inactivo';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'motivo del rechazo de inactivo: ' || sqlerrm;
  end;

  -- El total debe cuadrar (constraint de la tabla)
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
      '{}'::jsonb, item::jsonb, 20, 0, 0, 0, 99, 48);
    raise exception 'un total que no cuadra debe rechazarse';
  exception when check_violation then null; end;
end $$;
reset role;

rollback;

select 'RLS OK' as resultado;
