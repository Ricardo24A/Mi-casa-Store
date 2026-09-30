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

  begin
    update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'el cliente no puede marcar su pedido como pagado';
  exception when insufficient_privilege then null; end;

  begin
    update public.payment_proofs set estado = 'aprobado' where order_id = '30000000-0000-0000-0000-000000000001';
    raise exception 'el cliente no puede aprobar su comprobante';
  exception when insufficient_privilege then null; end;

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

  -- Ni el admin cambia estados con un UPDATE directo: solo las funciones admin_* (que cuidan el stock)
  begin
    update public.payment_proofs set estado = 'rechazado', motivo = 'x' where order_id = '30000000-0000-0000-0000-000000000001';
    raise exception 'el admin no revisa comprobantes con un UPDATE directo';
  exception when insufficient_privilege then null; end;

  begin
    update public.orders set estado = 'rechazado' where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'el admin no cambia el estado con un UPDATE directo';
  exception when insufficient_privilege then null; end;

  update public.orders set notas = 'nota interna' where id = '30000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'el admin sí puede anotar notas en el pedido';

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
-- cart_items: carrito de la cuenta (solo el dueño; anon nada; máximo 50 líneas; cantidad 1..99)
-- ---------------------------------------------------------------------------
insert into public.products (category_id, nombre, slug, precio, stock)
select '10000000-0000-0000-0000-000000000001', 'Carrito ' || g, 'p-cart-' || g, 5, 10
from generate_series(1, 51) as g;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

do $$
declare n integer;
begin
  -- 50 líneas: 49 productos de prueba + el producto que usa la prueba de create_order
  insert into public.cart_items (user_id, product_id, cantidad)
  select '00000000-0000-0000-0000-0000000000c1', p.id, 2
  from public.products p where p.slug in (select 'p-cart-' || g from generate_series(1, 49) g);
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001', 1);
  assert (select count(*) from public.cart_items) = 50, 'el cliente ve sus 50 líneas';

  -- La línea 51 se rechaza
  begin
    insert into public.cart_items (user_id, product_id, cantidad)
    select '00000000-0000-0000-0000-0000000000c1', p.id, 1 from public.products p where p.slug = 'p-cart-50';
    raise exception 'la línea 51 debe rechazarse';
  exception when check_violation then null; end;

  -- Una línea que ya existe se puede actualizar aunque haya 50 (upsert)
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001', 3)
  on conflict (user_id, product_id) do update set cantidad = excluded.cantidad;
  assert (select cantidad from public.cart_items where product_id = '20000000-0000-0000-0000-000000000001') = 3,
    'el upsert actualiza una línea existente con el carrito lleno';

  -- Cantidad inválida
  begin
    update public.cart_items set cantidad = 0 where product_id = '20000000-0000-0000-0000-000000000001';
    raise exception 'cantidad 0 debe rechazarse';
  exception when check_violation then null; end;
  begin
    update public.cart_items set cantidad = 100 where product_id = '20000000-0000-0000-0000-000000000001';
    raise exception 'cantidad 100 debe rechazarse';
  exception when check_violation then null; end;

  -- No se puede crear una línea a nombre de otro
  begin
    insert into public.cart_items (user_id, product_id, cantidad)
    select '00000000-0000-0000-0000-0000000000c2', p.id, 1 from public.products p where p.slug = 'p-cart-51';
    raise exception 'no debe poder escribir en el carrito de otro';
  exception when insufficient_privilege then null; end;
end $$;

reset role;

-- El otro cliente no ve ni toca las líneas ajenas
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
do $$
declare n integer;
begin
  assert (select count(*) from public.cart_items) = 0, 'un cliente no ve el carrito de otro';
  update public.cart_items set cantidad = 1;
  get diagnostics n = row_count;
  assert n = 0, 'un cliente no modifica el carrito de otro';
  delete from public.cart_items;
  get diagnostics n = row_count;
  assert n = 0, 'un cliente no borra el carrito de otro';
end $$;
reset role;

-- Un administrador tampoco lee carritos ajenos con la API (solo el servidor, con service_role)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
do $$
begin
  assert (select count(*) from public.cart_items) = 0, 'ni el admin ve carritos ajenos por la API';
end $$;
reset role;

-- anon: nada
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.cart_items;
    raise exception 'anon no debe leer carritos';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.cart_items (user_id, product_id, cantidad)
    values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001', 1);
    raise exception 'anon no debe escribir carritos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- El servidor (service_role) sí las ve
set local role service_role;
do $$
begin
  assert (select count(*) from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1') = 50,
    'service_role lee el carrito para el checkout';
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
  assert (select count(*) from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1') = 0,
    'al crear el pedido se vacían las líneas del carrito de esa cuenta';

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

  -- Un pedido rechazado no vacía el carrito de nadie
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-000000000001', 1);
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c2', 'C2', 'c2@test.ec', '0999999992',
      '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":100}]'::jsonb,
      1000, 0, 0, 0, 1000, 48);
    raise exception 'no debe vender más de lo disponible';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'motivo: ' || sqlerrm;
  end;
  assert (select count(*) from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c2') = 1,
    'un pedido rechazado no vacía el carrito';

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

-- ---------------------------------------------------------------------------
-- Reserva de stock: nunca negativa ni mayor que el stock
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update public.products set stock_reservado = -1 where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'la reserva no puede ser negativa';
  exception when check_violation then null; end;

  begin
    update public.products set stock_reservado = stock + 1 where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'la reserva no puede superar el stock';
  exception when check_violation then null; end;

  -- Bajar el stock por debajo de lo reservado también se rechaza
  update public.products set stock = 10, stock_reservado = 4 where id = '20000000-0000-0000-0000-000000000002';
  begin
    update public.products set stock = 3 where id = '20000000-0000-0000-0000-000000000002';
    raise exception 'el stock no puede bajar de lo reservado';
  exception when check_violation then null; end;
  update public.products set stock = 5, stock_reservado = 0 where id = '20000000-0000-0000-0000-000000000002';
end $$;

-- ---------------------------------------------------------------------------
-- create_order: cantidad debe ser > 0
-- ---------------------------------------------------------------------------
set local role service_role;
do $$
declare bad text;
begin
  foreach bad in array array[
    '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":0}]',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":-1}]',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":1.5}]',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":"2"}]',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":101}]',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10}]'
  ] loop
    begin
      perform public.create_order('00000000-0000-0000-0000-0000000000c2', 'C2', 'c2@test.ec', '0999999992',
        '{}'::jsonb, bad::jsonb, 10, 0, 0, 0, 10, 48);
      raise exception 'create_order debía rechazar: %', bad;
    exception when raise_exception then
      assert sqlerrm = 'cantidad_invalida', 'motivo del rechazo (' || bad || '): ' || sqlerrm;
    end;
  end loop;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- submit_payment_proof: comprobante atómico
-- ---------------------------------------------------------------------------
insert into public.orders
  (id, user_id, contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
values
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 day'),
  ('30000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', 'C2', 'c2@test.ec', '0999999992', 10, 10, now() + interval '1 day'),
  ('30000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() - interval '1 hour');

-- Ni anon ni un usuario autenticado la ejecutan
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1',
      '30000000-0000-0000-0000-0000000000a1', 'c1/x.png', repeat('e', 64));
    raise exception 'un usuario autenticado no debe ejecutar submit_payment_proof';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.submit_payment_proof(null, '30000000-0000-0000-0000-0000000000a1', 'x', repeat('e', 64));
    raise exception 'anon no debe ejecutar submit_payment_proof';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare r record;
begin
  -- Sin usuario
  begin
    perform public.submit_payment_proof(null, '30000000-0000-0000-0000-0000000000a1', 'x', repeat('e', 64));
    raise exception 'sin usuario debe rechazarse';
  exception when raise_exception then
    assert sqlerrm = 'cuenta_requerida', 'sin usuario: ' || sqlerrm;
  end;

  -- El pedido de otro usuario se rechaza con el mismo error que uno inexistente
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1',
      '30000000-0000-0000-0000-0000000000a2', 'c1/x.png', repeat('e', 64));
    raise exception 'no debe adjuntar a un pedido ajeno';
  exception when raise_exception then
    assert sqlerrm = 'pedido_no_encontrado', 'pedido ajeno: ' || sqlerrm;
  end;
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1',
      '30000000-0000-0000-0000-00000000ffff', 'c1/x.png', repeat('e', 64));
    raise exception 'un pedido inexistente debe rechazarse';
  exception when raise_exception then
    assert sqlerrm = 'pedido_no_encontrado', 'pedido inexistente: ' || sqlerrm;
  end;

  -- Un pedido vencido no admite comprobante
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1',
      '30000000-0000-0000-0000-0000000000a3', 'c1/x.png', repeat('e', 64));
    raise exception 'un pedido vencido debe rechazarse';
  exception when raise_exception then
    assert sqlerrm = 'pedido_vencido', 'pedido vencido: ' || sqlerrm;
  end;
  assert (select count(*) from public.payment_proofs where order_id = '30000000-0000-0000-0000-0000000000a3') = 0,
    'un intento rechazado no deja comprobante';

  -- Caso feliz
  select * into r from public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1',
    '30000000-0000-0000-0000-0000000000a1', 'c1/a1/uno.png', repeat('e', 64));
  assert r.o_proof_id is not null, 'devuelve el id del comprobante';
  assert r.o_duplicado = false, 'primer uso del archivo: no es duplicado';
  assert (select estado from public.orders where id = '30000000-0000-0000-0000-0000000000a1') = 'comprobante_recibido',
    'el pedido pasa a comprobante_recibido';
  assert (select estado from public.payment_proofs where id = r.o_proof_id) = 'en_revision',
    'el comprobante queda en revisión';

  -- Un segundo archivo sobre un pedido con comprobante en revisión es un REEMPLAZO
  select * into r from public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1',
    '30000000-0000-0000-0000-0000000000a1', 'c1/a1/dos.png', repeat('f', 64));
  assert r.o_reemplazo = true, 'subir otro archivo con uno en revisión es un reemplazo';
  assert r.o_archivo_anterior = 'c1/a1/uno.png', 'devuelve el archivo reemplazado para borrarlo del bucket';
  assert (select count(*) from public.payment_proofs where order_id = '30000000-0000-0000-0000-0000000000a1') = 2,
    'el anterior queda como historial';
  assert (select count(*) from public.payment_proofs
          where order_id = '30000000-0000-0000-0000-0000000000a1' and estado in ('en_revision', 'aprobado')) = 1,
    'un solo comprobante activo por pedido';

  -- El mismo archivo (hash) en OTRO pedido se acepta pero se marca como duplicado
  select * into r from public.submit_payment_proof('00000000-0000-0000-0000-0000000000c2',
    '30000000-0000-0000-0000-0000000000a2', 'c2/a2/uno.png', repeat('f', 64));
  assert r.o_duplicado = true, 'el mismo hash en otro pedido se marca como duplicado';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Reemplazo de comprobantes: un solo activo por pedido, historial, tope de 3 y carreras
-- ---------------------------------------------------------------------------
insert into public.orders
  (id, user_id, contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
values
  ('30000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 day'),
  ('30000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 day'),
  ('30000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 day'),
  ('30000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 day'),
  ('30000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 day');

-- b4: comprobante en revisión, pero el plazo ya venció (el cron aún no lo marcó)
insert into public.orders
  (id, user_id, contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en)
values ('30000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991', 10, 10, now() + interval '1 hour');
insert into public.payment_proofs (order_id, archivo, hash) values
  ('30000000-0000-0000-0000-0000000000b4', 'c1/b4/uno.png', repeat('1', 64));
update public.orders set estado = 'comprobante_recibido', vence_en = now() - interval '1 minute'
  where id = '30000000-0000-0000-0000-0000000000b4';

set local role service_role;
do $$
declare
  r record;
  vence_antes timestamptz;
  id_viejo uuid;
  id_nuevo uuid;
begin
  -- ---- Reemplazo feliz -----------------------------------------------------
  select vence_en into vence_antes from public.orders where id = '30000000-0000-0000-0000-0000000000b1';
  perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b1', 'c1/b1/1.png', repeat('a', 63) || '1');
  select * into r from public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b1', 'c1/b1/2.png', repeat('a', 63) || '2');
  assert r.o_reemplazo and r.o_archivo_anterior = 'c1/b1/1.png', 'reemplazo feliz devuelve el archivo anterior';
  assert (select estado from public.payment_proofs where archivo = 'c1/b1/1.png') = 'reemplazado', 'el anterior queda reemplazado';
  assert (select estado from public.payment_proofs where archivo = 'c1/b1/2.png') = 'en_revision', 'el nuevo queda en revisión';
  assert (select estado from public.orders where id = '30000000-0000-0000-0000-0000000000b1') = 'comprobante_recibido',
    'el pedido sigue en comprobante_recibido';
  assert (select vence_en from public.orders where id = '30000000-0000-0000-0000-0000000000b1') = vence_antes,
    'el plazo no se reinicia';

  -- El mismo archivo no cuenta como reemplazo
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b1', 'c1/b1/3.png', repeat('a', 63) || '2');
    raise exception 'el mismo archivo no debe reemplazar';
  exception when raise_exception then
    assert sqlerrm = 'mismo_archivo', 'mismo archivo: ' || sqlerrm;
  end;

  -- ---- Tope de 3 comprobantes por pedido -----------------------------------
  select * into r from public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b1', 'c1/b1/3.png', repeat('a', 63) || '3');
  assert r.o_reemplazo, 'tercer comprobante permitido';
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b1', 'c1/b1/4.png', repeat('a', 63) || '4');
    raise exception 'el cuarto comprobante debe rechazarse';
  exception when raise_exception then
    assert sqlerrm = 'limite_comprobantes', 'cuarto comprobante: ' || sqlerrm;
  end;
  assert (select count(*) from public.payment_proofs where order_id = '30000000-0000-0000-0000-0000000000b1') = 3, 'máximo 3 comprobantes';
  assert (select count(*) from public.payment_proofs where order_id = '30000000-0000-0000-0000-0000000000b1' and estado in ('en_revision', 'aprobado')) = 1,
    'y siempre uno solo activo';

  -- ---- Aprobado: no se reemplaza -------------------------------------------
  perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b2', 'c1/b2/1.png', repeat('b', 63) || '1');
  reset role;
  update public.payment_proofs set estado = 'aprobado' where archivo = 'c1/b2/1.png';
  set local role service_role;
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b2', 'c1/b2/2.png', repeat('b', 63) || '2');
    raise exception 'un comprobante aprobado no se reemplaza';
  exception when raise_exception then
    assert sqlerrm = 'comprobante_aprobado', 'aprobado: ' || sqlerrm;
  end;
  reset role;
  update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-0000000000b2';
  set local role service_role;
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b2', 'c1/b2/3.png', repeat('b', 63) || '3');
    raise exception 'un pedido pagado no admite comprobantes';
  exception when raise_exception then
    assert sqlerrm = 'estado_invalido', 'pedido pagado: ' || sqlerrm;
  end;

  -- ---- Pedido vencido: no admite reemplazo ---------------------------------
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b4', 'c1/b4/2.png', repeat('2', 64));
    raise exception 'un pedido vencido no admite reemplazo';
  exception when raise_exception then
    assert sqlerrm = 'pedido_vencido', 'vencido: ' || sqlerrm;
  end;
  assert (select estado from public.payment_proofs where archivo = 'c1/b4/uno.png') = 'en_revision',
    'un intento rechazado no toca el comprobante vigente';

  -- ---- Pedido ajeno --------------------------------------------------------
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-0000000000b3', 'c2/b3/1.png', repeat('c', 64));
    raise exception 'no debe adjuntar a un pedido ajeno';
  exception when raise_exception then
    assert sqlerrm = 'pedido_no_encontrado', 'ajeno: ' || sqlerrm;
  end;
  perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b3', 'c1/b3/1.png', repeat('c', 63) || '1');
  begin
    perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-0000000000b3', 'c2/b3/2.png', repeat('c', 64));
    raise exception 'no debe reemplazar el comprobante de otro';
  exception when raise_exception then
    assert sqlerrm = 'pedido_no_encontrado', 'reemplazo ajeno: ' || sqlerrm;
  end;
  assert (select estado from public.payment_proofs where archivo = 'c1/b3/1.png') = 'en_revision', 'el ajeno no toca el comprobante';

  -- ---- Rechazado (opción A): el pedido vuelve a pendiente_pago y sube uno nuevo ----
  perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b5', 'c1/b5/1.png', repeat('d', 63) || '1');
  reset role;
  update public.payment_proofs set estado = 'rechazado', motivo = 'Monto incorrecto', revisado_en = now() where archivo = 'c1/b5/1.png';
  update public.orders set estado = 'pendiente_pago' where id = '30000000-0000-0000-0000-0000000000b5';
  set local role service_role;
  select * into r from public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b5', 'c1/b5/2.png', repeat('d', 63) || '2');
  assert r.o_reemplazo = false, 'tras un rechazo es una subida nueva, no un reemplazo';
  assert (select estado from public.payment_proofs where archivo = 'c1/b5/1.png') = 'rechazado'
     and (select motivo from public.payment_proofs where archivo = 'c1/b5/1.png') = 'Monto incorrecto',
    'el rechazado queda como historial con su motivo';
  assert (select estado from public.orders where id = '30000000-0000-0000-0000-0000000000b5') = 'comprobante_recibido', 'el pedido vuelve a comprobante_recibido';

  -- ---- Carrera entre reemplazo y aprobación --------------------------------
  -- Orden 1: el dueño aprueba primero -> el reemplazo ve el estado que dejó la aprobación y falla.
  -- (b2 ya lo probó: aprobado -> 'comprobante_aprobado' y pagado -> 'estado_invalido'.)
  -- Orden 2: el reemplazo va primero -> una aprobación "vieja" del comprobante ya reemplazado NO se aplica.
  perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b6', 'c1/b6/viejo.png', repeat('e', 63) || '1');
  select id into id_viejo from public.payment_proofs where archivo = 'c1/b6/viejo.png';
  perform public.submit_payment_proof('00000000-0000-0000-0000-0000000000c1', '30000000-0000-0000-0000-0000000000b6', 'c1/b6/nuevo.png', repeat('e', 63) || '2');
  select id into id_nuevo from public.payment_proofs where archivo = 'c1/b6/nuevo.png';
  reset role;
  begin
    update public.payment_proofs set estado = 'aprobado' where id = id_viejo;
    raise exception 'no se puede aprobar un comprobante ya reemplazado';
  exception when raise_exception then
    assert sqlerrm = 'transicion_invalida', 'aprobación vieja: ' || sqlerrm;
  end;
  update public.payment_proofs set estado = 'aprobado' where id = id_nuevo;
  update public.orders set estado = 'pagado' where id = '30000000-0000-0000-0000-0000000000b6';
  assert (select estado from public.orders where id = '30000000-0000-0000-0000-0000000000b6') = 'pagado', 'se aprueba el vigente';

  -- ---- Reglas de la tabla --------------------------------------------------
  begin
    insert into public.payment_proofs (order_id, archivo, hash)
    values ('30000000-0000-0000-0000-0000000000b3', 'c1/b3/otro.png', repeat('9', 64));
    raise exception 'no debe haber dos comprobantes activos en un pedido';
  exception when unique_violation then null; end;

  begin
    update public.payment_proofs set estado = 'reemplazado' where archivo = 'c1/b3/1.png';
    raise exception 'reemplazado solo lo puede poner submit_payment_proof';
  exception when raise_exception then
    assert sqlerrm = 'transicion_invalida', 'reemplazado fuera de la función: ' || sqlerrm;
  end;

  begin
    update public.payment_proofs set estado = 'en_revision' where id = id_nuevo;
    raise exception 'un comprobante aprobado no vuelve a revisión';
  exception when raise_exception then
    assert sqlerrm = 'transicion_invalida', 'aprobado es final: ' || sqlerrm;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Vencimiento automático y cambios de estado con reserva de stock
-- ---------------------------------------------------------------------------
insert into public.products (id, category_id, nombre, slug, precio, stock)
values ('20000000-0000-0000-0000-0000000000f9', '10000000-0000-0000-0000-000000000001', 'Flujo', 'p-flujo', 10, 100);

-- Crea un pedido (con reserva) para un usuario, y opcionalmente con su comprobante en revisión.
create function pg_temp.mk_order(p_user uuid, p_qty integer, p_with_proof boolean, p_tag text)
returns uuid
language plpgsql
as $$
declare v uuid;
begin
  set local role service_role;
  select o_id into v from public.create_order(p_user, 'N', 'n@test.ec', '0999999999', '{}'::jsonb,
    jsonb_build_array(jsonb_build_object('product_id', '20000000-0000-0000-0000-0000000000f9',
                                         'nombre', 'Flujo', 'precio_unitario', 10, 'cantidad', p_qty)),
    p_qty * 10, 0, 0, 0, p_qty * 10, 48);
  if p_with_proof then
    perform public.submit_payment_proof(p_user, v, 'flujo/' || p_tag || '.png', md5(p_tag) || md5(p_tag || 'x'));
  end if;
  reset role;
  return v;
end;
$$;

-- ---- Vencimiento ------------------------------------------------------------
do $$
declare
  pid constant uuid := '20000000-0000-0000-0000-0000000000f9';
  c1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  ex1 uuid; ex2 uuid; ex3 uuid;
  rs integer; n integer;
begin
  ex1 := pg_temp.mk_order(c1, 2, false, 'ex1');  -- pendiente y vencido
  ex2 := pg_temp.mk_order(c1, 1, false, 'ex2');  -- pendiente y vigente
  ex3 := pg_temp.mk_order(c1, 1, true,  'ex3');  -- con comprobante en revisión, plazo vencido
  update public.orders set vence_en = now() - interval '1 minute' where id in (ex1, ex3);
  select stock_reservado into rs from public.products where id = pid;
  assert rs = 4, 'antes de vencer hay 4 unidades reservadas';

  -- Solo el servidor (y el cron) la ejecuta
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
  begin
    perform public.expire_orders();
    raise exception 'un usuario autenticado no debe ejecutar expire_orders';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.expire_orders();
    raise exception 'anon no debe ejecutar expire_orders';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role service_role;
  begin
    perform public.expire_orders(0);
    raise exception 'el límite debe ser válido';
  exception when raise_exception then
    assert sqlerrm = 'limite_invalido', 'límite: ' || sqlerrm;
  end;
  n := public.expire_orders(1000);
  assert n >= 1, 'venció al menos un pedido';
  reset role;

  assert (select estado from public.orders where id = ex1) = 'vencido', 'el pedido pendiente y vencido pasa a vencido';
  assert (select motivo_estado from public.orders where id = ex1) = 'Venció el plazo de pago', 'con su motivo';
  assert (select reserva_activa from public.orders where id = ex1) = false, 'sin reserva activa';
  assert (select estado from public.orders where id = ex2) = 'pendiente_pago', 'el vigente no vence';
  assert (select estado from public.orders where id = ex3) = 'comprobante_recibido', 'con comprobante en revisión no vence: lo resuelve el dueño';
  select stock_reservado into rs from public.products where id = pid;
  assert rs = 2, 'se liberaron las 2 unidades del pedido vencido';

  -- Idempotente: repetirla no vence ni libera nada más
  set local role service_role;
  n := public.expire_orders(1000);
  reset role;
  assert n = 0, 'la segunda corrida no encuentra nada que vencer';
  select stock_reservado into rs from public.products where id = pid;
  assert rs = 2, 'y no libera dos veces';

  -- Doble liberación directa: la reserva ya está liberada, no se vuelve a liberar ni a reactivar
  perform public.order_release_reservation(ex1);
  select stock_reservado into rs from public.products where id = pid;
  assert rs = 2, 'liberar una reserva ya liberada no hace nada';
  begin
    update public.orders set reserva_activa = true where id = ex1;
    raise exception 'una reserva liberada no se reactiva';
  exception when raise_exception then
    assert sqlerrm = 'reserva_ya_liberada', 'reactivar: ' || sqlerrm;
  end;

  -- Un pedido vencido no admite comprobante
  set local role service_role;
  begin
    perform public.submit_payment_proof(c1, ex1, 'flujo/tarde.png', repeat('7', 64));
    raise exception 'un pedido vencido no admite comprobante';
  exception when raise_exception then
    assert sqlerrm = 'estado_invalido', 'comprobante en vencido: ' || sqlerrm;
  end;
  reset role;
end $$;

-- ---- Cambios de estado ------------------------------------------------------
do $$
declare
  pid constant uuid := '20000000-0000-0000-0000-0000000000f9';
  c1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  c2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  oa uuid; ob uuid; oc uuid; od uuid; oe uuid; ofx uuid; og uuid; oh uuid; oi uuid; oj uuid;
  pa uuid; pb1 uuid; pb2 uuid; pc uuid; pd uuid; pe uuid; pd2 uuid;
  st integer; rs integer; st0 integer; rs0 integer;
  horas integer; r text; i integer;
begin
  select horas_limite_pago into horas from public.store_settings;

  -- ================= Aprobar =================
  oa := pg_temp.mk_order(c1, 3, true, 'A');
  select id into pa from public.payment_proofs where order_id = oa;
  select stock, stock_reservado into st0, rs0 from public.products where id = pid;

  -- Solo el administrador con 2FA
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin
    perform public.admin_approve_order(oa, pa);
    raise exception 'un cliente no aprueba';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'cliente: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', aal1_claims, true);
  begin
    perform public.admin_approve_order(oa, pa);
    raise exception 'un admin sin 2FA no aprueba';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'admin aal1: ' || sqlerrm; end;
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.admin_approve_order(oa, pa);
    raise exception 'anon no aprueba';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select estado from public.orders where id = oa) = 'comprobante_recibido', 'los intentos no autorizados no cambian nada';

  -- Aprobación
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  r := public.admin_approve_order(oa, pa);
  reset role;
  assert r = 'pagado', 'devuelve el nuevo estado';
  assert (select estado from public.orders where id = oa) = 'pagado', 'el pedido queda pagado';
  assert (select estado from public.payment_proofs where id = pa) = 'aprobado', 'el comprobante queda aprobado';
  assert (select revisado_por from public.payment_proofs where id = pa) = '00000000-0000-0000-0000-0000000000a1', 'queda quién lo revisó';
  assert (select reserva_activa from public.orders where id = oa) = false, 'la reserva se consumió';
  select stock, stock_reservado into st, rs from public.products where id = pid;
  assert st = st0 - 3 and rs = rs0 - 3, 'descuenta 3 del stock y libera 3 de la reserva';

  -- Doble aprobación
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_approve_order(oa, pa);
    raise exception 'no se puede aprobar dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'doble aprobación: ' || sqlerrm; end;
  reset role;
  select stock, stock_reservado into st, rs from public.products where id = pid;
  assert st = st0 - 3 and rs = rs0 - 3, 'la segunda aprobación no descuenta otra vez';

  -- Aprobar un comprobante que el cliente ya reemplazó
  ob := pg_temp.mk_order(c1, 1, true, 'B1');
  select id into pb1 from public.payment_proofs where order_id = ob;
  set local role service_role;
  perform public.submit_payment_proof(c1, ob, 'flujo/B2.png', md5('B2') || md5('B2x'));
  reset role;
  select id into pb2 from public.payment_proofs where order_id = ob and estado = 'en_revision';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_approve_order(ob, pb1);
    raise exception 'no se aprueba un comprobante reemplazado';
  exception when raise_exception then assert sqlerrm = 'comprobante_no_vigente', 'comprobante viejo: ' || sqlerrm; end;
  begin
    perform public.admin_approve_order(ob, gen_random_uuid());
    raise exception 'un comprobante inexistente no se aprueba';
  exception when raise_exception then assert sqlerrm = 'comprobante_no_encontrado', 'inexistente: ' || sqlerrm; end;
  perform public.admin_approve_order(ob, pb2);
  reset role;
  assert (select estado from public.orders where id = ob) = 'pagado', 'se aprueba el vigente';

  -- Un pedido pendiente (sin comprobante) no se aprueba
  oc := pg_temp.mk_order(c1, 1, false, 'C');
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_approve_order(oc, gen_random_uuid());
    raise exception 'sin comprobante no se aprueba';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'sin comprobante: ' || sqlerrm; end;
  reset role;

  -- ================= Rechazar el comprobante (opción A) =================
  od := pg_temp.mk_order(c1, 2, true, 'D1');
  select id into pd from public.payment_proofs where order_id = od;
  select stock_reservado into rs0 from public.products where id = pid;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_reject_proof(od, pd, '  ');
    raise exception 'el motivo es obligatorio';
  exception when raise_exception then assert sqlerrm = 'motivo_invalido', 'sin motivo: ' || sqlerrm; end;
  begin
    perform public.admin_reject_proof(od, pd, 'ab');
    raise exception 'el motivo debe tener sentido';
  exception when raise_exception then assert sqlerrm = 'motivo_invalido', 'motivo corto: ' || sqlerrm; end;
  r := public.admin_reject_proof(od, pd, 'El monto no coincide');
  reset role;
  assert r = 'pendiente_pago', 'el pedido vuelve a pendiente de pago';
  assert (select estado from public.orders where id = od) = 'pendiente_pago', 'estado del pedido';
  assert (select estado from public.payment_proofs where id = pd) = 'rechazado'
     and (select motivo from public.payment_proofs where id = pd) = 'El monto no coincide', 'comprobante rechazado con motivo';
  assert (select reserva_activa from public.orders where id = od), 'la reserva se conserva';
  select stock_reservado into rs from public.products where id = pid;
  assert rs = rs0, 'y el stock reservado no cambia';
  assert (select vence_en from public.orders where id = od) >= now() + make_interval(hours => horas) - interval '1 minute',
    'plazo NUEVO de horas_limite_pago contado desde el rechazo';

  -- Doble rechazo del mismo comprobante
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_reject_proof(od, pd, 'Otra vez');
    raise exception 'no se rechaza dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'doble rechazo: ' || sqlerrm; end;
  reset role;

  -- El cliente sube uno nuevo y el viejo ya no se puede tocar
  set local role service_role;
  perform public.submit_payment_proof(c1, od, 'flujo/D2.png', md5('D2') || md5('D2x'));
  reset role;
  select id into pd2 from public.payment_proofs where order_id = od and estado = 'en_revision';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_reject_proof(od, pd, 'Sobre el viejo');
    raise exception 'el comprobante viejo no es vigente';
  exception when raise_exception then assert sqlerrm = 'comprobante_no_vigente', 'viejo: ' || sqlerrm; end;
  perform public.admin_reject_proof(od, pd2, 'Sigue sin coincidir');
  reset role;

  -- Acotado: como mucho 3 comprobantes por pedido, así que el plazo nuevo solo se da 3 veces
  set local role service_role;
  perform public.submit_payment_proof(c1, od, 'flujo/D3.png', md5('D3') || md5('D3x'));
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  perform public.admin_reject_proof(od, (select id from public.payment_proofs where order_id = od and estado = 'en_revision'), 'Tercer rechazo');
  reset role;
  assert (select count(*) from public.payment_proofs where order_id = od) = 3, 'tres comprobantes en el historial';
  set local role service_role;
  begin
    perform public.submit_payment_proof(c1, od, 'flujo/D4.png', md5('D4') || md5('D4x'));
    raise exception 'el cuarto comprobante debe rechazarse';
  exception when raise_exception then assert sqlerrm = 'limite_comprobantes', 'cuarto: ' || sqlerrm; end;
  reset role;
  assert (select reserva_activa from public.orders where id = od), 'la reserva sigue hasta que venza o se cancele';

  -- ================= Rechazar el pedido definitivamente =================
  oe := pg_temp.mk_order(c2, 2, true, 'E');
  select id into pe from public.payment_proofs where order_id = oe;
  select stock_reservado into rs0 from public.products where id = pid;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  r := public.admin_reject_order(oe, 'Transferencia no recibida');
  reset role;
  assert r = 'rechazado' and (select estado from public.orders where id = oe) = 'rechazado', 'pedido rechazado';
  assert (select motivo_estado from public.orders where id = oe) = 'Transferencia no recibida', 'con su motivo';
  assert (select estado from public.payment_proofs where id = pe) = 'rechazado', 'su comprobante también';
  select stock_reservado into rs from public.products where id = pid;
  assert rs = rs0 - 2, 'libera la reserva';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_reject_order(oe, 'Otra vez');
    raise exception 'no se rechaza dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'doble rechazo del pedido: ' || sqlerrm; end;
  reset role;
  select stock_reservado into rs from public.products where id = pid;
  assert rs = rs0 - 2, 'no libera dos veces';

  -- ================= Cancelar =================
  ofx := pg_temp.mk_order(c1, 4, false, 'F');   -- pendiente de pago
  og  := pg_temp.mk_order(c1, 1, true,  'G');   -- con comprobante en revisión
  select stock_reservado into rs0 from public.products where id = pid;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  r := public.admin_cancel_order(ofx, 'El cliente lo pidió');
  reset role;
  assert r = 'cancelado' and (select estado from public.orders where id = ofx) = 'cancelado', 'pedido cancelado';
  select stock_reservado into rs from public.products where id = pid;
  assert rs = rs0 - 4, 'cancelar libera la reserva';

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_cancel_order(ofx, 'Otra vez');
    raise exception 'no se cancela dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'doble cancelación: ' || sqlerrm; end;
  begin
    perform public.admin_cancel_order(oa, 'Ya estaba pagado');
    raise exception 'un pedido pagado no se cancela';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'cancelar pagado: ' || sqlerrm; end;
  r := public.admin_cancel_order(og, 'Sin stock real');
  reset role;
  select stock_reservado into rs from public.products where id = pid;
  assert rs = rs0 - 5, 'cancelar el que tenía comprobante también libera (y una sola vez)';
  assert (select estado from public.payment_proofs where order_id = og) = 'rechazado', 'su comprobante en revisión se cierra';
  select stock into st from public.products where id = pid;
  assert st = st0 - 3 - 1, 'cancelar y rechazar no tocan el stock definitivo (solo las aprobaciones descuentan)';

  -- ================= Cruces entre vencer y cancelar =================
  oh := pg_temp.mk_order(c1, 1, false, 'H');
  oi := pg_temp.mk_order(c1, 1, false, 'I');
  update public.orders set vence_en = now() - interval '1 minute' where id in (oh, oi);
  select stock_reservado into rs0 from public.products where id = pid;
  -- H: primero el dueño cancela; luego corre el vencimiento
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  perform public.admin_cancel_order(oh, 'Cancelado antes de vencer');
  reset role;
  set local role service_role;
  perform public.expire_orders(1000);
  reset role;
  assert (select estado from public.orders where id = oh) = 'cancelado', 'vencer no pisa un pedido ya cancelado';
  -- I: venció por el cron; luego el dueño intenta cancelar
  assert (select estado from public.orders where id = oi) = 'vencido', 'I venció';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_cancel_order(oi, 'Tarde');
    raise exception 'un pedido vencido no se cancela';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'cancelar vencido: ' || sqlerrm; end;
  reset role;
  select stock_reservado into rs from public.products where id = pid;
  assert rs = rs0 - 2, 'cada pedido liberó su unidad exactamente una vez';

  -- ================= Sin UPDATE directo por la API =================
  oj := pg_temp.mk_order(c1, 1, true, 'J');
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    update public.orders set estado = 'pagado' where id = oj;
    raise exception 'ni el admin cambia el estado con UPDATE';
  exception when insufficient_privilege then null; end;
  begin
    update public.payment_proofs set estado = 'aprobado' where order_id = oj;
    raise exception 'ni el admin aprueba un comprobante con UPDATE';
  exception when insufficient_privilege then null; end;
  reset role;

  -- Invariantes del stock
  assert (select count(*) from public.products where stock_reservado < 0 or stock_reservado > stock) = 0,
    'la reserva nunca es negativa ni supera el stock';
end $$;

rollback;

select 'RLS OK' as resultado;
