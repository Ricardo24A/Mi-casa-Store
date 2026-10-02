-- Pruebas de RLS, permisos y restricciones.
-- Corre dentro de una transacción y termina con ROLLBACK: no deja datos.
-- Ejecutar SOLO en un proyecto de desarrollo/staging (SQL Editor o `supabase test db`),
-- después de aplicar las migraciones. Si algo falla, lanza una excepción con el motivo;
-- si todo pasa, devuelve 'RLS OK'.
begin;

-- ---------------------------------------------------------------------------
-- Configuración en estado conocido. `store_settings` es una sola fila que el dueño edita, así que
-- las pruebas no pueden suponer sus valores reales (Facebook guardado, otro plazo, etc.). Se fija
-- aquí, DENTRO de la transacción: el ROLLBACK final devuelve los valores reales.
-- Regla de este archivo: toda prueba debe dar el mismo resultado sobre una base vacía y sobre una
-- con datos reales; se compara contra la línea base de abajo o contra filas creadas por la prueba.
-- ---------------------------------------------------------------------------
update public.store_settings set
  nombre_negocio = 'Mi casa Store', email_contacto = null, telefono = null, telefono_secundario = null,
  direccion = null, cuentas_bancarias = '[]'::jsonb, costo_envio = null, envio_gratis_desde = null,
  descuento_transferencia_pct = 0, horas_limite_pago = 48, umbral_stock_bajo = 5, enlaces_redes = '{}'::jsonb,
  horario_atencion = null;

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

  -- Pedido válido: guarda el usuario, aparta el stock y crea las líneas. Desde la migración 21 las
  -- líneas deben ser exactamente las del carrito de la cuenta.
  delete from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1';
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001', 2);
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
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001', 99);
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
      '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":99}]'::jsonb,
      990, 0, 0, 0, 990, 48);
    raise exception 'no debe vender más de lo disponible';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'motivo del rechazo por stock: ' || sqlerrm;
  end;
  assert (select stock_reservado from public.products where id = '20000000-0000-0000-0000-000000000001') = reservado_antes + 2,
    'un pedido rechazado no deja stock apartado';

  -- Un pedido rechazado no vacía el carrito de nadie
  delete from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c2';
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-000000000001', 99);
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c2', 'C2', 'c2@test.ec', '0999999992',
      '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-000000000001","nombre":"Activo","precio_unitario":10,"cantidad":99}]'::jsonb,
      990, 0, 0, 0, 990, 48);
    raise exception 'no debe vender más de lo disponible';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'motivo: ' || sqlerrm;
  end;
  assert (select count(*) from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c2') = 1,
    'un pedido rechazado no vacía el carrito';

  -- Producto inactivo: no se vende
  delete from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1';
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000002', 1);
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
  delete from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1';
  insert into public.cart_items (user_id, product_id, cantidad)
  values ('00000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001', 2);
  begin
    perform public.create_order('00000000-0000-0000-0000-0000000000c1', 'C1', 'c1@test.ec', '0999999991',
      '{}'::jsonb, item::jsonb, 20, 0, 0, 0, 99, 48);
    raise exception 'un total que no cuadra debe rechazarse';
  exception when check_violation then null; end;
  delete from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1';
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

-- Crea un pedido (con reserva) y, opcionalmente, su comprobante en revisión. Cada pedido es de un
-- usuario nuevo: así el tope de 3 pendientes por cuenta (migración 21) no interfiere con estas pruebas.
-- El dueño se consulta con `(select user_id from public.orders where id = ...)`. Como create_order exige
-- que las líneas sean las del carrito, primero se llena el carrito de ese usuario.
create function pg_temp.mk_order(p_qty integer, p_with_proof boolean, p_tag text)
returns uuid
language plpgsql
as $$
declare
  v uuid;
  p_user uuid := gen_random_uuid();
begin
  insert into auth.users (id) values (p_user);
  insert into public.cart_items (user_id, product_id, cantidad)
  values (p_user, '20000000-0000-0000-0000-0000000000f9', p_qty);
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
  ex1 := pg_temp.mk_order(2, false, 'ex1');  -- pendiente y vencido
  ex2 := pg_temp.mk_order(1, false, 'ex2');  -- pendiente y vigente
  ex3 := pg_temp.mk_order(1, true,  'ex3');  -- con comprobante en revisión, plazo vencido
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
    perform public.submit_payment_proof((select user_id from public.orders where id = ex1), ex1, 'flujo/tarde.png', repeat('7', 64));
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
  oa := pg_temp.mk_order(3, true, 'A');
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
  assert (select pagado_en from public.orders where id = oa) is not null, 'aprobar guarda la fecha de pago';
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
  ob := pg_temp.mk_order(1, true, 'B1');
  select id into pb1 from public.payment_proofs where order_id = ob;
  set local role service_role;
  perform public.submit_payment_proof((select user_id from public.orders where id = ob), ob, 'flujo/B2.png', md5('B2') || md5('B2x'));
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
  oc := pg_temp.mk_order(1, false, 'C');
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_approve_order(oc, gen_random_uuid());
    raise exception 'sin comprobante no se aprueba';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'sin comprobante: ' || sqlerrm; end;
  reset role;

  -- ================= Rechazar el comprobante (opción A) =================
  od := pg_temp.mk_order(2, true, 'D1');
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
  perform public.submit_payment_proof((select user_id from public.orders where id = od), od, 'flujo/D2.png', md5('D2') || md5('D2x'));
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
  perform public.submit_payment_proof((select user_id from public.orders where id = od), od, 'flujo/D3.png', md5('D3') || md5('D3x'));
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  perform public.admin_reject_proof(od, (select id from public.payment_proofs where order_id = od and estado = 'en_revision'), 'Tercer rechazo');
  reset role;
  assert (select count(*) from public.payment_proofs where order_id = od) = 3, 'tres comprobantes en el historial';
  set local role service_role;
  begin
    perform public.submit_payment_proof((select user_id from public.orders where id = od), od, 'flujo/D4.png', md5('D4') || md5('D4x'));
    raise exception 'el cuarto comprobante debe rechazarse';
  exception when raise_exception then assert sqlerrm = 'limite_comprobantes', 'cuarto: ' || sqlerrm; end;
  reset role;
  assert (select reserva_activa from public.orders where id = od), 'la reserva sigue hasta que venza o se cancele';

  -- ================= Rechazar el pedido definitivamente =================
  oe := pg_temp.mk_order(2, true, 'E');
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
  ofx := pg_temp.mk_order(4, false, 'F');   -- pendiente de pago
  og  := pg_temp.mk_order(1, true,  'G');   -- con comprobante en revisión
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
  oh := pg_temp.mk_order(1, false, 'H');
  oi := pg_temp.mk_order(1, false, 'I');
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
  oj := pg_temp.mk_order(1, true, 'J');
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

-- ---------------------------------------------------------------------------
-- Categorías del dashboard: activa/desactivada, dos niveles, nombres únicos y orden
-- ---------------------------------------------------------------------------
insert into public.categories (id, nombre, slug, orden) values
  ('40000000-0000-0000-0000-000000000001', 'Adm A', 'adm-a', 0),
  ('40000000-0000-0000-0000-000000000002', 'Adm B', 'adm-b', 1),
  ('40000000-0000-0000-0000-000000000003', 'Adm C', 'adm-c', 2);
insert into public.categories (id, parent_id, nombre, slug, orden) values
  ('40000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000001', 'Adm A1', 'adm-a1', 0),
  ('40000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000001', 'Adm A2', 'adm-a2', 1);
insert into public.products (id, category_id, nombre, slug, precio, activo) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000011', 'Prod adm', 'prod-adm', 5, true);

do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  a1 constant uuid := '40000000-0000-0000-0000-000000000011';
  a2 constant uuid := '40000000-0000-0000-0000-000000000012';
  pa constant uuid := '40000000-0000-0000-0000-000000000001';
begin
  assert (select activa from public.categories where id = pa), 'una categoría nueva nace activa';

  -- ---- Visible: solo con productos activos (como antes) -------------------------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select count(*) from public.visible_categories where slug in ('adm-a', 'adm-a1')) = 2, 'con producto activo: visibles';
  assert (select count(*) from public.visible_categories where slug = 'adm-a2') = 0, 'sin productos: oculta';
  assert (select count(*) from public.products where slug = 'prod-adm') = 1, 'el producto se ve';
  reset role;

  -- ---- Desactivar la subcategoría: desaparece con su producto ---------------------
  update public.categories set activa = false where id = a1;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select count(*) from public.visible_categories where slug in ('adm-a', 'adm-a1')) = 0,
    'desactivada la subcategoría, ni ella ni su categoría (sin más productos) se ven';
  assert (select count(*) from public.products where slug = 'prod-adm') = 0, 'sus productos no se ven en la tienda';
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  assert (select count(*) from public.products where slug = 'prod-adm') = 0, 'un cliente tampoco los ve';
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  assert (select count(*) from public.products where slug = 'prod-adm') = 1, 'el administrador con 2FA sí los ve';
  assert (select count(*) from public.categories where id = a1) = 1, 'y la categoría sigue existiendo para él';
  reset role;
  assert not public.category_visible(a1), 'category_visible: desactivada';

  -- ---- Reactivar -------------------------------------------------------------------
  update public.categories set activa = true where id = a1;
  assert public.category_visible(a1), 'category_visible: reactivada';
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select count(*) from public.visible_categories where slug in ('adm-a', 'adm-a1')) = 2, 'reactivada: vuelve';
  assert (select count(*) from public.products where slug = 'prod-adm') = 1, 'y sus productos';
  reset role;

  -- ---- Desactivar la categoría padre oculta a sus hijas aunque estén activas ---------
  update public.categories set activa = false where id = pa;
  assert not public.category_visible(a1), 'hija activa de un padre desactivado: no visible';
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select count(*) from public.visible_categories where slug in ('adm-a', 'adm-a1')) = 0, 'el padre desactivado oculta todo';
  assert (select count(*) from public.products where slug = 'prod-adm') = 0, 'y sus productos';
  reset role;
  update public.categories set activa = true where id = pa;

  -- ---- Dos niveles -----------------------------------------------------------------
  begin
    insert into public.categories (parent_id, nombre, slug) values (a1, 'Nieta', 'adm-nieta');
    raise exception 'no debe haber un tercer nivel';
  exception when check_violation then null; end;
  begin
    update public.categories set parent_id = '40000000-0000-0000-0000-000000000002' where id = pa;
    raise exception 'una categoría con subcategorías no pasa a ser subcategoría';
  exception when check_violation then null; end;
  update public.categories set parent_id = '40000000-0000-0000-0000-000000000002' where id = '40000000-0000-0000-0000-000000000003';
  assert (select parent_id from public.categories where id = '40000000-0000-0000-0000-000000000003') = '40000000-0000-0000-0000-000000000002',
    'una categoría sin hijas sí puede pasar a subcategoría';
  update public.categories set parent_id = null where id = '40000000-0000-0000-0000-000000000003';

  -- ---- Nombres únicos dentro del mismo padre ---------------------------------------
  begin
    insert into public.categories (nombre, slug) values ('ADM a', 'adm-a-otra');
    raise exception 'un nombre repetido (sin importar mayúsculas) debe rechazarse';
  exception when unique_violation then null; end;
  insert into public.categories (parent_id, nombre, slug) values ('40000000-0000-0000-0000-000000000002', 'Adm A1', 'adm-b-a1');

  -- ---- Ordenar ---------------------------------------------------------------------
  -- Permisos
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin
    perform public.admin_move_category(a2, 'arriba');
    raise exception 'un cliente no ordena categorías';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'cliente: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', aal1_claims, true);
  begin
    perform public.admin_move_category(a2, 'arriba');
    raise exception 'un admin sin 2FA no ordena categorías';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'admin aal1: ' || sqlerrm; end;
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.admin_move_category(a2, 'arriba');
    raise exception 'anon no ordena categorías';
  exception when insufficient_privilege then null; end;
  reset role;

  -- Con el administrador
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin
    perform public.admin_move_category(a2, 'lado');
    raise exception 'la dirección debe ser válida';
  exception when raise_exception then assert sqlerrm = 'direccion_invalida', 'dirección: ' || sqlerrm; end;
  begin
    perform public.admin_move_category(gen_random_uuid(), 'arriba');
    raise exception 'la categoría debe existir';
  exception when raise_exception then assert sqlerrm = 'categoria_no_encontrada', 'inexistente: ' || sqlerrm; end;

  perform public.admin_move_category(a2, 'arriba');
  reset role;
  assert (select orden from public.categories where id = a2) = 0 and (select orden from public.categories where id = a1) = 1,
    'A2 sube y A1 baja';

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  perform public.admin_move_category(a2, 'arriba');   -- ya es la primera: no cambia
  perform public.admin_move_category(a1, 'abajo');    -- ya es la última: no cambia
  reset role;
  assert (select orden from public.categories where id = a2) = 0 and (select orden from public.categories where id = a1) = 1,
    'en los extremos no cambia nada';

  -- Con órdenes repetidos o con huecos, se renumera de 0 a n-1 sin repetir
  update public.categories set orden = 7 where id in (a1, a2);
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  perform public.admin_move_category(a1, 'arriba');
  reset role;
  assert (select count(distinct orden) from public.categories where parent_id = pa) = 2
     and (select min(orden) from public.categories where parent_id = pa) = 0
     and (select max(orden) from public.categories where parent_id = pa) = 1,
    'el orden queda contiguo de 0 a n-1';
end $$;

-- ---------------------------------------------------------------------------
-- Producto en el carrito cuya categoría se desactiva: no disponible aunque se lea con la clave de servidor
-- ---------------------------------------------------------------------------
insert into public.products (id, category_id, nombre, slug, precio, stock, activo)
values ('50000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000012', 'Producto de categoría apagable', 'p-cat-off', 10, 10, true);
-- Está en el carrito de la cuenta c1 (y es lo único en él: create_order exige que coincidan)
delete from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.cart_items (user_id, product_id, cantidad)
values ('00000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000c1', 2);

do $$
declare
  pid constant uuid := '50000000-0000-0000-0000-0000000000c1';
  c1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  items constant text := '[{"product_id":"50000000-0000-0000-0000-0000000000c1","nombre":"Producto de categoría apagable","precio_unitario":10,"cantidad":2}]';
  o record;
  rs integer;
begin
  -- Con la categoría activa, el producto se vende
  assert public.category_visible('40000000-0000-0000-0000-000000000012'), 'la categoría está activa';

  -- Se desactiva la subcategoría
  update public.categories set activa = false where id = '40000000-0000-0000-0000-000000000012';

  -- La tienda (RLS) ya no lo ve...
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select count(*) from public.products where id = pid) = 0, 'la tienda no ve el producto';
  reset role;

  -- ...pero el servidor (service_role se salta RLS) SÍ lo lee: por eso create_order lo comprueba sola.
  set local role service_role;
  assert (select count(*) from public.products where id = pid) = 1, 'con la clave de servidor el producto se lee';
  begin
    perform public.create_order(c1, 'C1', 'c1@test.ec', '0999999991', '{}'::jsonb, items::jsonb, 20, 0, 0, 0, 20, 48);
    raise exception 'create_order no debe vender un producto de una categoría desactivada';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'categoría desactivada: ' || sqlerrm;
  end;
  reset role;
  assert (select stock_reservado from public.products where id = pid) = 0, 'no quedó nada reservado';
  assert (select count(*) from public.cart_items where user_id = c1 and product_id = pid) = 1,
    'un pedido rechazado no toca el carrito';

  -- Lo mismo si la que se desactiva es la categoría PADRE (la subcategoría sigue activa)
  update public.categories set activa = true where id = '40000000-0000-0000-0000-000000000012';
  update public.categories set activa = false where id = '40000000-0000-0000-0000-000000000001';
  set local role service_role;
  begin
    perform public.create_order(c1, 'C1', 'c1@test.ec', '0999999991', '{}'::jsonb, items::jsonb, 20, 0, 0, 0, 20, 48);
    raise exception 'create_order no debe vender si el padre está desactivado';
  exception when raise_exception then
    assert sqlerrm = 'stock_insuficiente', 'padre desactivado: ' || sqlerrm;
  end;
  reset role;

  -- Al reactivar, se vende con normalidad
  update public.categories set activa = true where id = '40000000-0000-0000-0000-000000000001';
  set local role service_role;
  select * into o from public.create_order(c1, 'C1', 'c1@test.ec', '0999999991', '{}'::jsonb, items::jsonb, 20, 0, 0, 0, 20, 48);
  reset role;
  assert o.o_referencia is not null, 'reactivada la categoría, el pedido se crea';
  select stock_reservado into rs from public.products where id = pid;
  assert rs = 2, 'y aparta el stock';
end $$;

-- ---------------------------------------------------------------------------
-- Buckets: límites de tamaño y tipos
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select file_size_limit from storage.buckets where id = 'product-images') = 4194304,
    'las imágenes de productos admiten hasta 4 MB';
  assert (select file_size_limit from storage.buckets where id = 'payment-proofs') = 4194304,
    'los comprobantes admiten hasta 4 MB';
  assert (select public from storage.buckets where id = 'product-images'), 'product-images es público (lectura)';
  assert not (select public from storage.buckets where id = 'payment-proofs'), 'payment-proofs es privado';
  assert (select allowed_mime_types from storage.buckets where id = 'product-images') @> array['image/jpeg', 'image/png', 'image/webp']
     and cardinality((select allowed_mime_types from storage.buckets where id = 'product-images')) = 3,
    'product-images solo admite JPG, PNG y WebP';
end $$;

-- ---------------------------------------------------------------------------
-- Descuentos: datos válidos, destino existente, limpieza y permisos
-- ---------------------------------------------------------------------------
insert into public.categories (id, nombre, slug) values ('60000000-0000-0000-0000-000000000001', 'Desc cat', 'desc-cat');
insert into public.products (id, category_id, nombre, slug, precio, stock)
values ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Desc prod', 'desc-prod', 10, 5);

do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  dcat constant uuid := '60000000-0000-0000-0000-000000000001';
  dprod constant uuid := '60000000-0000-0000-0000-000000000002';
  n integer;
  base_pub integer;
begin
  -- ---- Datos válidos (superusuario) ----------------------------------------------
  begin
    insert into public.discounts (nombre, tipo, valor, alcance) values ('Cien', 'porcentaje', 100, 'tienda');
    raise exception 'un 100%% debe rechazarse';
  exception when check_violation then null; end;
  insert into public.discounts (nombre, tipo, valor, alcance) values ('Casi todo', 'porcentaje', 99.99, 'tienda');
  begin
    insert into public.discounts (nombre, tipo, valor, alcance) values ('Cero', 'monto_fijo', 0, 'tienda');
    raise exception 'el valor debe ser mayor que 0';
  exception when check_violation then null; end;
  begin
    insert into public.discounts (nombre, tipo, valor, alcance, inicia, termina)
    values ('Fechas mal', 'monto_fijo', 1, 'tienda', now(), now() - interval '1 day');
    raise exception 'termina debe ser posterior a inicia';
  exception when check_violation then null; end;
  begin
    insert into public.discounts (nombre, tipo, valor, alcance, target_id) values ('Tienda con destino', 'monto_fijo', 1, 'tienda', dprod);
    raise exception 'toda la tienda no lleva destino';
  exception when check_violation then null; end;
  begin
    insert into public.discounts (nombre, tipo, valor, alcance) values ('Producto sin destino', 'monto_fijo', 1, 'producto');
    raise exception 'un descuento por producto necesita destino';
  exception when check_violation then null; end;

  -- ---- El destino debe existir ----------------------------------------------------
  begin
    insert into public.discounts (nombre, tipo, valor, alcance, target_id) values ('Fantasma', 'monto_fijo', 1, 'producto', gen_random_uuid());
    raise exception 'un producto inexistente debe rechazarse';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.discounts (nombre, tipo, valor, alcance, target_id) values ('Fantasma cat', 'porcentaje', 5, 'categoria', gen_random_uuid());
    raise exception 'una categoría inexistente debe rechazarse';
  exception when check_violation then null; end;
  begin
    -- El id de una categoría no vale como destino de un producto, y al revés
    insert into public.discounts (nombre, tipo, valor, alcance, target_id) values ('Mezcla', 'monto_fijo', 1, 'producto', dcat);
    raise exception 'el destino debe ser del tipo del alcance (producto)';
  exception when check_violation then null; end;
  begin
    insert into public.discounts (nombre, tipo, valor, alcance, target_id) values ('Mezcla 2', 'monto_fijo', 1, 'categoria', dprod);
    raise exception 'el destino debe ser del tipo del alcance (categoría)';
  exception when check_violation then null; end;
  insert into public.discounts (id, nombre, tipo, valor, alcance, target_id) values
    ('61000000-0000-0000-0000-000000000001', 'Por producto', 'porcentaje', 15, 'producto', dprod),
    ('61000000-0000-0000-0000-000000000002', 'Por categoría', 'monto_fijo', 2, 'categoria', dcat);
  begin
    update public.discounts set target_id = gen_random_uuid() where id = '61000000-0000-0000-0000-000000000001';
    raise exception 'editar un descuento tampoco admite un destino inexistente';
  exception when check_violation then null; end;

  -- ---- Al borrar el producto o la categoría, sus descuentos desaparecen ----------------
  delete from public.products where id = dprod;
  assert (select count(*) from public.discounts where id = '61000000-0000-0000-0000-000000000001') = 0,
    'al borrar el producto se borra su descuento';
  assert (select count(*) from public.discounts where id = '61000000-0000-0000-0000-000000000002') = 1,
    'el de la categoría sigue';
  delete from public.categories where id = dcat;
  assert (select count(*) from public.discounts where id = '61000000-0000-0000-0000-000000000002') = 0,
    'al borrar la categoría se borra su descuento';
  assert (select count(*) from public.discounts where nombre = 'Casi todo') = 1, 'los de toda la tienda no se tocan';
  delete from public.discounts where nombre = 'Casi todo';

  -- ---- Lectura pública: solo automáticos, activos y vigentes -----------------------------
  insert into public.discounts (nombre, tipo, valor, alcance, codigo, inicia, termina, activo) values
    ('P vigente',  'porcentaje', 5, 'tienda', null,       now() - interval '1 day', now() + interval '1 day', true),
    ('P cupón',    'porcentaje', 5, 'tienda', 'CUPON55',  now() - interval '1 day', now() + interval '1 day', true),
    ('P apagado',  'porcentaje', 5, 'tienda', null,       now() - interval '1 day', now() + interval '1 day', false),
    ('P futuro',   'porcentaje', 5, 'tienda', null,       now() + interval '1 day', now() + interval '2 day', true),
    ('P vencido',  'porcentaje', 5, 'tienda', null,       now() - interval '3 day', now() - interval '2 day', true);

  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select count(*) from public.discounts where nombre like 'P %') = 1, 'el público solo ve el automático, activo y vigente';
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  assert (select count(*) from public.discounts where nombre like 'P %') = 1, 'un cliente tampoco ve el resto';
  perform set_config('request.jwt.claims', admin_claims, true);
  assert (select count(*) from public.discounts where nombre like 'P %') = 5, 'el administrador con 2FA ve todos';
  perform set_config('request.jwt.claims', aal1_claims, true);
  assert (select count(*) from public.discounts where nombre like 'P %') = 1, 'un administrador sin 2FA ve lo mismo que el público';
  reset role;

  -- ---- Escritura: solo el administrador con 2FA ---------------------------------------------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    insert into public.discounts (nombre, tipo, valor, alcance) values ('anon', 'porcentaje', 5, 'tienda');
    raise exception 'anon no crea descuentos';
  exception when insufficient_privilege then null; end;
  reset role;

  for i in 1..2 loop
    set local role authenticated;
    perform set_config('request.jwt.claims', case i when 1 then cust_claims else aal1_claims end, true);
    begin
      insert into public.discounts (nombre, tipo, valor, alcance) values ('intruso', 'porcentaje', 5, 'tienda');
      raise exception 'sin ser administrador con 2FA no se crean descuentos';
    exception when insufficient_privilege then null; end;
    update public.discounts set valor = 50 where nombre = 'P vigente';
    get diagnostics n = row_count;
    assert n = 0, 'sin ser administrador con 2FA no se editan descuentos';
    delete from public.discounts where nombre like 'P %';
    get diagnostics n = row_count;
    assert n = 0, 'sin ser administrador con 2FA no se borran descuentos';
    reset role;
  end loop;

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  insert into public.discounts (nombre, tipo, valor, alcance) values ('P admin', 'monto_fijo', 1, 'tienda');
  update public.discounts set valor = 2 where nombre = 'P admin';
  get diagnostics n = row_count;
  assert n = 1, 'el administrador con 2FA edita';
  begin
    update public.discounts set valor = 100, tipo = 'porcentaje' where nombre = 'P admin';
    raise exception 'ni el administrador puede guardar un 100%%';
  exception when check_violation then null; end;
  delete from public.discounts where nombre like 'P %';
  get diagnostics n = row_count;
  assert n = 6, 'y borra';
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Configuración: vista pública mínima, permisos de la tabla y validaciones
-- ---------------------------------------------------------------------------
do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  good constant text := '{"banco":"Banco Uno","tipo":"ahorros","numero":"1234567890","titular":"Ana Prueba","identificacion":"1712345678"}';
  cols text[];
  n integer;
  seen text;
begin
  -- ---- La vista pública trae SOLO nombre, contacto y redes -------------------------------
  select array_agg(column_name::text order by column_name) into cols
  from information_schema.columns where table_schema = 'public' and table_name = 'store_public_info';
  assert cols = array['direccion', 'email_contacto', 'enlaces_redes', 'horario_atencion', 'nombre_negocio', 'telefono', 'telefono_secundario'],
    'la vista pública solo expone nombre, contacto y redes: ' || coalesce(array_to_string(cols, ','), 'nada');

  update public.store_settings
     set email_contacto = 'hola@test.ec', telefono = '0984126739', direccion = 'Calle 1',
         enlaces_redes = '{"facebook":"https://facebook.com/tienda"}'::jsonb,
         cuentas_bancarias = ('[' || good || ']')::jsonb;

  -- Anónimo: lee la vista, no la tabla
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select email_contacto into seen from public.store_public_info;
  assert seen = 'hola@test.ec', 'el público lee el contacto por la vista';
  begin
    perform 1 from public.store_settings;
    raise exception 'anon no debe leer store_settings';
  exception when insufficient_privilege then null; end;
  begin
    perform cuentas_bancarias from public.store_public_info;
    raise exception 'la vista pública no debe traer las cuentas bancarias';
  exception when undefined_column then null; end;
  reset role;

  -- Cliente: la vista sí; la tabla, ninguna fila
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  assert (select count(*) from public.store_public_info) = 1, 'un cliente lee la vista';
  assert (select count(*) from public.store_settings) = 0, 'un cliente no ve store_settings';
  perform set_config('request.jwt.claims', aal1_claims, true);
  assert (select count(*) from public.store_settings) = 0, 'un admin sin 2FA no ve store_settings';
  perform set_config('request.jwt.claims', admin_claims, true);
  assert (select count(*) from public.store_settings) = 1, 'el admin con 2FA ve store_settings';
  reset role;

  -- ---- Escritura: solo el admin con 2FA, y sin tocar columnas internas ---------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  update public.store_settings set nombre_negocio = 'Intruso';
  get diagnostics n = row_count;
  assert n = 0, 'un cliente no edita la configuración';
  perform set_config('request.jwt.claims', aal1_claims, true);
  update public.store_settings set nombre_negocio = 'Intruso';
  get diagnostics n = row_count;
  assert n = 0, 'un admin sin 2FA no edita la configuración';
  perform set_config('request.jwt.claims', admin_claims, true);
  update public.store_settings set nombre_negocio = 'Mi casa Store', horas_limite_pago = 72;
  get diagnostics n = row_count;
  assert n = 1, 'el admin con 2FA edita';
  begin
    update public.store_settings set updated_at = now() - interval '1 year';
    raise exception 'updated_at no es editable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.store_settings (id) values (true);
    raise exception 'no se crean filas de configuración';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.store_settings;
    raise exception 'no se borra la configuración';
  exception when insufficient_privilege then null; end;
  reset role;

  -- ---- Límites ------------------------------------------------------------------------------
  begin update public.store_settings set horas_limite_pago = 0; raise exception 'plazo 0';
  exception when check_violation then null; end;
  begin update public.store_settings set horas_limite_pago = 169; raise exception 'plazo de más de 168 horas';
  exception when check_violation then null; end;
  update public.store_settings set horas_limite_pago = 1;
  update public.store_settings set horas_limite_pago = 168;
  update public.store_settings set horas_limite_pago = 48;

  begin update public.store_settings set descuento_transferencia_pct = 100; raise exception 'descuento del 100%%';
  exception when check_violation then null; end;
  begin update public.store_settings set descuento_transferencia_pct = -1; raise exception 'descuento negativo';
  exception when check_violation then null; end;
  update public.store_settings set descuento_transferencia_pct = 99.99;
  update public.store_settings set descuento_transferencia_pct = 0;

  update public.store_settings set costo_envio = null;   -- sin definir es válido
  begin update public.store_settings set costo_envio = -1; raise exception 'envío negativo';
  exception when check_violation then null; end;
  update public.store_settings set costo_envio = 0;
  begin update public.store_settings set envio_gratis_desde = 0; raise exception 'el umbral de envío gratis debe ser mayor que 0';
  exception when check_violation then null; end;
  update public.store_settings set envio_gratis_desde = 50;
  update public.store_settings set envio_gratis_desde = null;
  begin update public.store_settings set umbral_stock_bajo = -1; raise exception 'umbral negativo';
  exception when check_violation then null; end;

  -- ---- Cuentas bancarias: formato -----------------------------------------------------------
  update public.store_settings set cuentas_bancarias = ('[' || good || ',' || good || ']')::jsonb;
  update public.store_settings set cuentas_bancarias = '[]'::jsonb;
  begin update public.store_settings set cuentas_bancarias = '{}'::jsonb; raise exception 'debe ser una lista';
  exception when check_violation then null; end;
  begin update public.store_settings set cuentas_bancarias = '["texto"]'::jsonb; raise exception 'un elemento que no es objeto';
  exception when check_violation then null; end;
  begin update public.store_settings set cuentas_bancarias = '[{"banco":"Banco"}]'::jsonb; raise exception 'faltan datos';
  exception when check_violation then null; end;
  begin update public.store_settings set cuentas_bancarias = replace('[' || good || ']', 'ahorros', 'vista')::jsonb; raise exception 'tipo de cuenta inválido';
  exception when check_violation then null; end;
  begin update public.store_settings set cuentas_bancarias = replace('[' || good || ']', '1234567890', '12ab567890')::jsonb; raise exception 'el número son solo dígitos';
  exception when check_violation then null; end;
  begin update public.store_settings set cuentas_bancarias = replace('[' || good || ']', '"identificacion"', '"extra":"x","identificacion"')::jsonb; raise exception 'claves desconocidas';
  exception when check_violation then null; end;
  begin update public.store_settings set cuentas_bancarias = replace('[' || good || ']', '"1234567890"', '1234567890')::jsonb; raise exception 'el número debe ser texto';
  exception when check_violation then null; end;
  begin
    update public.store_settings set cuentas_bancarias =
      (select jsonb_agg(good::jsonb) from generate_series(1, 11));
    raise exception 'máximo 10 cuentas';
  exception when check_violation then null; end;

  -- ---- Redes: solo enlaces https ------------------------------------------------------------
  update public.store_settings set enlaces_redes = '{"facebook":"https://facebook.com/x","instagram":"https://instagram.com/y"}'::jsonb;
  update public.store_settings set enlaces_redes = '{}'::jsonb;
  -- Largo del enlace: 255 caracteres después de https:// se aceptan y 256 se rechazan
  update public.store_settings set enlaces_redes = jsonb_build_object('facebook', 'https://' || repeat('a', 255));
  begin update public.store_settings set enlaces_redes = jsonb_build_object('facebook', 'https://' || repeat('a', 256)); raise exception 'enlace de 256 caracteres';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '{"facebook":"https://abc"}'::jsonb; raise exception 'enlace demasiado corto';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '{"facebook":"http://facebook.com/x"}'::jsonb; raise exception 'solo https';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '{"facebook":"javascript:alert(1)"}'::jsonb; raise exception 'sin javascript:';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '{"facebook":"https://a b.com"}'::jsonb; raise exception 'sin espacios';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '{"facebook":5}'::jsonb; raise exception 'el enlace debe ser texto';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '{"Face Book":"https://facebook.com/x"}'::jsonb; raise exception 'nombre de red inválido';
  exception when check_violation then null; end;
  begin update public.store_settings set enlaces_redes = '[]'::jsonb; raise exception 'debe ser un objeto';
  exception when check_violation then null; end;

  -- La configuración vuelve a un estado neutro para lo que sigue
  update public.store_settings
     set email_contacto = null, telefono = null, telefono_secundario = null, direccion = null, cuentas_bancarias = '[]'::jsonb, enlaces_redes = '{}'::jsonb;
end $$;

-- ---------------------------------------------------------------------------
-- Teléfonos del negocio: formato de Ecuador validado en la base de datos
-- ---------------------------------------------------------------------------
do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  n integer;
  v text;
begin
  update public.store_settings set telefono = null, telefono_secundario = null;

  -- Válidos: celular, fijo (9 dígitos) y los dos a la vez
  update public.store_settings set telefono = '0984126739';
  update public.store_settings set telefono = '042638159';
  update public.store_settings set telefono = '0984126739', telefono_secundario = '022638159';
  update public.store_settings set telefono_secundario = '042345678';  -- una secuencia de 7 dígitos en un fijo es posible
  update public.store_settings set telefono_secundario = null;
  foreach v in array array['022638159', '032638159', '052638159', '062638159', '072638159', '0912345670', '0991234567'] loop
    update public.store_settings set telefono = v;
  end loop;

  -- Rechazados: formato
  foreach v in array array[
    '09841267391',      -- 11 dígitos
    '098412673',        -- celular de 9 dígitos
    '042638',           -- corto
    '0823456789',       -- 08 no existe
    '082638159',        -- código de provincia 08
    '012638159',        -- código de provincia 01
    '0901234567',       -- el tercer dígito no puede ser 0
    '+593984126739',    -- sin +593
    '593984126739',
    '984126739',        -- sin el 0 inicial
    '098 412 6739',     -- sin espacios
    '(04) 2638159',     -- sin paréntesis
    '04-263-8159',      -- sin guiones
    '098412673a',       -- letras
    '0984126739 0991234567',  -- dos números en un campo
    '',                 -- vacío no es null
    -- repetidos y secuencias
    '0999999999', '0911111111', '0900000000', '022222222', '042222222',
    '0912345678', '0987654321', '0923456789', '0998765432', '012345678'
  ] loop
    begin
      update public.store_settings set telefono = v;
      raise exception 'el teléfono % debía rechazarse', v;
    exception when check_violation then null; end;
  end loop;

  -- Duplicado entre los dos campos, y secundario sin principal
  update public.store_settings set telefono = '0984126739', telefono_secundario = null;
  begin
    update public.store_settings set telefono_secundario = '0984126739';
    raise exception 'el secundario no puede repetir al principal';
  exception when check_violation then null; end;
  begin
    update public.store_settings set telefono = null, telefono_secundario = '0991234567';
    raise exception 'el secundario no puede ir sin principal';
  exception when check_violation then null; end;
  begin
    update public.store_settings set telefono_secundario = '0991234567 0984126739';
    raise exception 'un campo no admite dos números';
  exception when check_violation then null; end;
  begin
    update public.store_settings set telefono_secundario = '098412673';
    raise exception 'el secundario también se valida';
  exception when check_violation then null; end;

  -- El admin con 2FA escribe el secundario; un cliente no
  update public.store_settings set telefono = '0984126739', telefono_secundario = null;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  update public.store_settings set telefono_secundario = '042638159';
  get diagnostics n = row_count;
  assert n = 1, 'el admin con 2FA edita el teléfono secundario';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
  update public.store_settings set telefono_secundario = '0991234567';
  get diagnostics n = row_count;
  assert n = 0, 'un cliente no edita el teléfono secundario';
  reset role;

  -- La vista pública los trae
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  assert (select telefono_secundario from public.store_public_info) = '042638159', 'el público lee el teléfono secundario por la vista';
  reset role;

  update public.store_settings set telefono = null, telefono_secundario = null;
end $$;

-- ---------------------------------------------------------------------------
-- Envío y entrega de pedidos, y datos del Resumen (migración 19)
-- Todo se compara contra el valor de ANTES (la base puede tener pedidos y productos reales).
-- ---------------------------------------------------------------------------
do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  cat constant uuid := '10000000-0000-0000-0000-000000000001';
  oa constant uuid := '31000000-0000-0000-0000-0000000000a1';  -- pagado ahora
  ob constant uuid := '31000000-0000-0000-0000-0000000000a2';  -- entregado ahora
  oc constant uuid := '31000000-0000-0000-0000-0000000000a3';  -- pagado hace mucho
  od constant uuid := '31000000-0000-0000-0000-0000000000a4';  -- cancelado
  oe constant uuid := '31000000-0000-0000-0000-0000000000a5';  -- pendiente
  ghost constant uuid := '31000000-0000-0000-0000-0000000000ff';
  s0 jsonb; s1 jsonb; a0 jsonb; a1 jsonb;
begin
  -- ---- Resumen: ventas y pedidos por estado --------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  s0 := public.admin_dashboard_summary();
  reset role;

  insert into public.orders (id, contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en, estado, pagado_en) values
    (oa, 'N', 'n@test.ec', '0999999999', 40, 40, now() + interval '1 day', 'pagado',    now()),
    (ob, 'N', 'n@test.ec', '0999999999', 10, 10, now() + interval '1 day', 'entregado', now()),
    (oc, 'N', 'n@test.ec', '0999999999', 99, 99, now() + interval '1 day', 'pagado',    now() - interval '400 days');
  insert into public.orders (id, contacto_nombre, contacto_email, contacto_telefono, subtotal, total, vence_en, estado) values
    (od, 'N', 'n@test.ec', '0999999999', 5, 5, now() + interval '1 day', 'cancelado'),
    (oe, 'N', 'n@test.ec', '0999999999', 7, 7, now() + interval '1 day', 'pendiente_pago');

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  s1 := public.admin_dashboard_summary();
  reset role;

  assert (s1 #>> '{hoy,pedidos}')::integer = (s0 #>> '{hoy,pedidos}')::integer + 2, 'hoy: cuenta pagado y entregado de ahora';
  assert (s1 #>> '{hoy,total}')::numeric = (s0 #>> '{hoy,total}')::numeric + 50, 'hoy: suma 40 + 10, sin el cancelado ni el pendiente ni el de hace mucho';
  assert (s1 #>> '{mes,pedidos}')::integer = (s0 #>> '{mes,pedidos}')::integer + 2, 'mes: igual que hoy para lo de ahora';
  assert (s1 #>> '{mes,total}')::numeric = (s0 #>> '{mes,total}')::numeric + 50, 'mes: el pagado de hace 400 días no cuenta';
  assert coalesce((s1 #>> '{estados,pagado}')::integer, 0) = coalesce((s0 #>> '{estados,pagado}')::integer, 0) + 2, 'estados: pagado';
  assert coalesce((s1 #>> '{estados,entregado}')::integer, 0) = coalesce((s0 #>> '{estados,entregado}')::integer, 0) + 1, 'estados: entregado';
  assert coalesce((s1 #>> '{estados,cancelado}')::integer, 0) = coalesce((s0 #>> '{estados,cancelado}')::integer, 0) + 1, 'estados: cancelado';
  assert coalesce((s1 #>> '{estados,pendiente_pago}')::integer, 0) = coalesce((s0 #>> '{estados,pendiente_pago}')::integer, 0) + 1, 'estados: pendiente';

  -- Solo el administrador con 2FA
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin perform public.admin_dashboard_summary(); raise exception 'un cliente no ve el resumen';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'resumen cliente: ' || sqlerrm; end;
  begin perform public.admin_stock_alerts(); raise exception 'un cliente no ve las alertas';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'alertas cliente: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', aal1_claims, true);
  begin perform public.admin_dashboard_summary(); raise exception 'un admin sin 2FA no ve el resumen';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'resumen aal1: ' || sqlerrm; end;
  begin perform public.admin_stock_alerts(); raise exception 'un admin sin 2FA no ve las alertas';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'alertas aal1: ' || sqlerrm; end;
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.admin_dashboard_summary(); raise exception 'anon no ve el resumen';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_stock_alerts(); raise exception 'anon no ve las alertas';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_mark_shipped(oa); raise exception 'anon no marca enviado';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_mark_delivered(oa); raise exception 'anon no marca entregado';
  exception when insufficient_privilege then null; end;
  reset role;

  -- ---- Alertas de stock (el umbral se fija aquí; la configuración real vuelve con el ROLLBACK) ----
  update public.store_settings set umbral_stock_bajo = 5;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  a0 := public.admin_stock_alerts(50);
  reset role;
  assert (a0 ->> 'umbral')::integer = 5, 'las alertas usan el umbral de Configuración';

  insert into public.products (id, category_id, nombre, slug, precio, stock, stock_reservado, activo) values
    ('20000000-0000-0000-0000-0000000000e1', cat, 'Alerta agotado',          'al-agotado',   10, 0,  0, true),
    ('20000000-0000-0000-0000-0000000000e2', cat, 'Alerta poco',             'al-poco',      10, 3,  0, true),
    ('20000000-0000-0000-0000-0000000000e3', cat, 'Alerta poco reservado',   'al-reservado', 10, 10, 8, true),
    ('20000000-0000-0000-0000-0000000000e4', cat, 'Alerta suficiente',       'al-ok',        10, 20, 0, true),
    ('20000000-0000-0000-0000-0000000000e5', cat, 'Alerta inactivo agotado', 'al-inactivo',  10, 0,  0, false),
    ('20000000-0000-0000-0000-0000000000e6', cat, 'Alerta justo en umbral',  'al-umbral',    10, 5,  0, true),
    ('20000000-0000-0000-0000-0000000000e7', cat, 'Alerta sobre el umbral',  'al-sobre',     10, 6,  0, true);

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  a1 := public.admin_stock_alerts(50);
  reset role;
  assert (a1 #>> '{agotados,total}')::integer = (a0 #>> '{agotados,total}')::integer + 1, 'agotados: solo el activo con stock 0';
  assert (a1 #>> '{poco,total}')::integer = (a0 #>> '{poco,total}')::integer + 3,
    'poco stock: 3 con 3 disponibles, 2 disponibles (10 menos 8 reservadas) y justo el umbral; no el de 6 ni el de 20';
  assert jsonb_array_length(a1 #> '{poco,items}') <= 50 and jsonb_array_length(a1 #> '{agotados,items}') <= 50, 'respeta el límite';
  assert (select count(*) from jsonb_array_elements(a1 #> '{poco,items}') e
          where (e ->> 'id')::uuid in ('20000000-0000-0000-0000-0000000000e4', '20000000-0000-0000-0000-0000000000e7')) = 0,
    'los que tienen stock suficiente no salen';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  assert jsonb_array_length(public.admin_stock_alerts(1) #> '{poco,items}') <= 1, 'con límite 1 trae como máximo uno';
  assert jsonb_array_length(public.admin_stock_alerts(0) #> '{poco,items}') <= 1, 'un límite menor que 1 se toma como 1';
  reset role;

  -- ---- Marcar enviado / entregado -----------------------------------------------------------------
  -- No autorizados no cambian nada
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin perform public.admin_mark_shipped(oa); raise exception 'un cliente no marca enviado';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'enviado cliente: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', aal1_claims, true);
  begin perform public.admin_mark_shipped(oa); raise exception 'un admin sin 2FA no marca enviado';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'enviado aal1: ' || sqlerrm; end;
  begin perform public.admin_mark_delivered(ob); raise exception 'un admin sin 2FA no marca entregado';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'entregado aal1: ' || sqlerrm; end;
  reset role;
  assert (select estado from public.orders where id = oa) = 'pagado', 'los intentos no autorizados no cambian el estado';

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);

  -- Solo desde el estado que corresponde
  begin perform public.admin_mark_shipped(ghost); raise exception 'pedido inexistente';
  exception when raise_exception then assert sqlerrm = 'pedido_no_encontrado', 'inexistente: ' || sqlerrm; end;
  begin perform public.admin_mark_delivered(oa); raise exception 'no se entrega lo que no se envió';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'entregar un pagado: ' || sqlerrm; end;
  begin perform public.admin_mark_shipped(oe); raise exception 'no se envía lo pendiente de pago';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'enviar un pendiente: ' || sqlerrm; end;
  begin perform public.admin_mark_shipped(od); raise exception 'no se envía lo cancelado';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'enviar un cancelado: ' || sqlerrm; end;
  begin perform public.admin_mark_shipped(ob); raise exception 'no se envía lo ya entregado';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'enviar un entregado: ' || sqlerrm; end;
  begin perform public.admin_mark_delivered(oe); raise exception 'no se entrega lo pendiente de pago';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'entregar un pendiente: ' || sqlerrm; end;

  -- Camino normal
  assert public.admin_mark_shipped(oa) = 'enviado', 'marcar enviado';
  reset role;
  assert (select estado from public.orders where id = oa) = 'enviado', 'el pedido queda enviado';
  assert (select enviado_en from public.orders where id = oa) is not null, 'con su fecha de envío';
  assert (select entregado_en from public.orders where id = oa) is null, 'sin fecha de entrega todavía';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin perform public.admin_mark_shipped(oa); raise exception 'enviar dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'enviar dos veces: ' || sqlerrm; end;
  assert public.admin_mark_delivered(oa) = 'entregado', 'marcar entregado';
  reset role;
  assert (select estado from public.orders where id = oa) = 'entregado', 'el pedido queda entregado';
  assert (select entregado_en from public.orders where id = oa) is not null, 'con su fecha de entrega';
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin perform public.admin_mark_delivered(oa); raise exception 'entregar dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'entregar dos veces: ' || sqlerrm; end;
  begin perform public.admin_mark_shipped(oa); raise exception 'no se vuelve atrás';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'enviar un entregado: ' || sqlerrm; end;

  -- Nada cambia el estado con UPDATE directo, ni las fechas nuevas
  begin update public.orders set estado = 'enviado' where id = oc; raise exception 'el estado no se cambia con UPDATE';
  exception when insufficient_privilege then null; end;
  begin update public.orders set pagado_en = now() where id = oc; raise exception 'pagado_en no es editable por la API';
  exception when insufficient_privilege then null; end;
  begin update public.orders set enviado_en = now() where id = oc; raise exception 'enviado_en no es editable por la API';
  exception when insufficient_privilege then null; end;
  begin update public.orders set entregado_en = now() where id = oc; raise exception 'entregado_en no es editable por la API';
  exception when insufficient_privilege then null; end;
  reset role;
  assert (select estado from public.orders where id = oc) = 'pagado', 'el pedido de prueba sigue pagado';
end $$;

-- ---------------------------------------------------------------------------
-- Mensajes de contacto y horario de atención (migración 20)
-- El correo y la huella de IP se generan al azar en cada corrida y todo se comprueba sobre los
-- mensajes creados aquí: los mensajes reales que haya en la base no cambian el resultado.
-- ---------------------------------------------------------------------------
do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  run   constant text := replace(gen_random_uuid()::text, '-', '');
  mail  constant text := 'contacto-' || run || '@test.ec';
  mail2 constant text := 'otro-' || run || '@test.ec';
  mail3 constant text := 'viejo-' || run || '@test.ec';
  ip    constant text := encode(sha256(convert_to('ip-' || run, 'UTF8')), 'hex');
  ip_viejo constant text := encode(sha256(convert_to('ip-viejo-' || run, 'UTF8')), 'hex');
  tel   constant text := '0984126739';
  texto constant text := 'Hola, quisiera saber si hacen envíos a Cuenca.';
  ghost constant uuid := '41000000-0000-0000-0000-0000000000ff';
  m1 uuid; m2 uuid; m3 uuid; mx uuid; viejo uuid;
  n integer;
  r record;
  seen text;
begin
  -- ---- Crear: solo el servidor (service_role) ejecuta la función ----------------------------------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.create_contact_message('Ana', mail, tel, null, texto, true, null); raise exception 'anon no crea mensajes directo';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin perform public.create_contact_message('Ana', mail, tel, null, texto, true, null); raise exception 'un cliente no crea mensajes directo';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin perform public.create_contact_message('Ana', mail, tel, null, texto, true, null); raise exception 'ni el admin crea mensajes directo';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role service_role;
  m1 := public.create_contact_message('Ana Prueba', mail, tel, 'Envíos', texto, true, ip);
  m2 := public.create_contact_message('Ana Prueba', mail, tel, '', texto, true, ip);
  m3 := public.create_contact_message('Ana Prueba', mail, '042345678', null, E'Primera línea\n\tsegunda línea del mensaje', true, ip);
  -- Ni el servidor lee la tabla directo: solo crea por la función
  begin perform 1 from public.contact_messages; raise exception 'service_role no lee la tabla directo';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_mark_message_read(m1); raise exception 'service_role no cambia estados';
  exception when insufficient_privilege then null; end;
  reset role;

  select * into r from public.contact_messages where id = m1;
  assert r.estado = 'nuevo' and r.leido_en is null, 'un mensaje nace nuevo y sin leer';
  assert r.aceptado_en is not null, 'guarda cuándo aceptó el tratamiento de datos';
  assert r.asunto = 'Envíos' and r.telefono = tel and r.ip_hash = ip, 'guarda los datos tal cual';
  assert (select asunto from public.contact_messages where id = m2) is null, 'un asunto vacío queda en null';
  assert (select mensaje from public.contact_messages where id = m3) = E'Primera línea\n\tsegunda línea del mensaje',
    'el mensaje admite saltos de línea y tabuladores';

  -- ---- La función rechaza datos inválidos (y no guarda nada) ---------------------------------------
  set local role service_role;
  n := 0;
  for r in
    select * from (values
      ('A',                  mail2, tel,             null::text,       texto,                                  true,  null::text,      'nombre_invalido'),
      ('<b>Ana</b>',         mail2, tel,             null,             texto,                                  true,  null,            'nombre_invalido'),
      (E'Ana\nPrueba',       mail2, tel,             null,             texto,                                  true,  null,            'nombre_invalido'),
      (' Ana',               mail2, tel,             null,             texto,                                  true,  null,            'nombre_invalido'),
      (repeat('a', 121),     mail2, tel,             null,             texto,                                  true,  null,            'nombre_invalido'),
      (null,                 mail2, tel,             null,             texto,                                  true,  null,            'nombre_invalido'),
      ('Ana',                'sin-arroba.ec', tel,   null,             texto,                                  true,  null,            'email_invalido'),
      ('Ana',                'ana@correo', tel,      null,             texto,                                  true,  null,            'email_invalido'),
      ('Ana',                'ana..b@test.ec', tel,  null,             texto,                                  true,  null,            'email_invalido'),
      ('Ana',                repeat('a', 65) || '@test.ec', tel, null, texto,                                  true,  null,            'email_invalido'),
      ('Ana',                '<x>@test.ec', tel,     null,             texto,                                  true,  null,            'email_invalido'),
      ('Ana',                mail2, '0812345678',    null,             texto,                                  true,  null,            'telefono_invalido'),
      ('Ana',                mail2, '+593984126739', null,             texto,                                  true,  null,            'telefono_invalido'),
      ('Ana',                mail2, '0999999999',    null,             texto,                                  true,  null,            'telefono_invalido'),
      ('Ana',                mail2, null,            null,             texto,                                  true,  null,            'telefono_invalido'),
      ('Ana',                mail2, tel,             repeat('a', 121), texto,                                  true,  null,            'asunto_invalido'),
      ('Ana',                mail2, tel,             '<script>',       texto,                                  true,  null,            'asunto_invalido'),
      ('Ana',                mail2, tel,             null,             'corto',                                true,  null,            'mensaje_invalido'),
      ('Ana',                mail2, tel,             null,             repeat('a', 1001),                      true,  null,            'mensaje_invalido'),
      ('Ana',                mail2, tel,             null,             '<script>alert(1)</script> hola',       true,  null,            'mensaje_invalido'),
      ('Ana',                mail2, tel,             null,             'Hola ' || chr(7) || ' qué tal amigos', true,  null,            'mensaje_invalido'),
      ('Ana',                mail2, tel,             null,             '  con espacios al borde  ',            true,  null,            'mensaje_invalido'),
      ('Ana',                mail2, tel,             null,             null,                                   true,  null,            'mensaje_invalido'),
      ('Ana',                mail2, tel,             null,             texto,                                  false, null,            'aceptacion_requerida'),
      ('Ana',                mail2, tel,             null,             texto,                                  null,  null,            'aceptacion_requerida'),
      ('Ana',                mail2, tel,             null,             texto,                                  true,  'no-es-un-hash', 'ip_invalido')
    ) as t(nombre, email, telefono, asunto, mensaje, acepta, ip_hash, esperado)
  loop
    begin
      perform public.create_contact_message(r.nombre, r.email, r.telefono, r.asunto, r.mensaje, r.acepta, r.ip_hash);
      raise exception 'debía rechazarse con %', r.esperado;
    exception when raise_exception then
      assert sqlerrm = r.esperado, 'esperaba ' || r.esperado || ' y llegó: ' || sqlerrm;
    end;
    n := n + 1;
  end loop;
  reset role;
  assert n = 26, 'se probaron todos los casos inválidos';
  assert (select count(*) from public.contact_messages where lower(email) = lower(mail2)) = 0, 'los rechazados no se guardan';

  -- ---- Límite por correo: 3 en una hora, sin distinguir mayúsculas ---------------------------------
  set local role service_role;
  begin
    perform public.create_contact_message('Ana Prueba', upper(mail), tel, null, texto, true, null);
    raise exception 'el cuarto mensaje del mismo correo en una hora debía rechazarse';
  exception when raise_exception then assert sqlerrm = 'limite_mensajes', 'límite por correo: ' || sqlerrm; end;
  reset role;
  assert (select count(*) from public.contact_messages where lower(email) = lower(mail)) = 3, 'el correo queda con 3 mensajes';

  -- Lo de hace más de una hora no cuenta
  insert into public.contact_messages (nombre, email, telefono, mensaje, aceptado_en, created_at)
  select 'Viejo', mail3, tel, texto, now() - interval '2 hours', now() - interval '2 hours' from generate_series(1, 3);
  set local role service_role;
  mx := public.create_contact_message('Viejo', mail3, tel, null, texto, true, null);
  reset role;
  assert mx is not null, 'los mensajes de hace más de una hora no cuentan para el límite';

  -- ---- Límite por IP: 10 en una hora (3 ya usados arriba) -------------------------------------------
  set local role service_role;
  for i in 1..7 loop
    perform public.create_contact_message('Ana Prueba', 'ip' || i || '-' || mail, tel, null, texto, true, ip);
  end loop;
  begin
    perform public.create_contact_message('Ana Prueba', 'ip-extra-' || mail, tel, null, texto, true, ip);
    raise exception 'el mensaje 11 del mismo IP en una hora debía rechazarse';
  exception when raise_exception then assert sqlerrm = 'limite_mensajes', 'límite por IP: ' || sqlerrm; end;
  -- Sin IP (desarrollo local) solo cuenta el correo
  mx := public.create_contact_message('Ana Prueba', 'sin-ip-' || mail, tel, null, texto, true, null);
  reset role;
  assert mx is not null, 'sin IP se aplica solo el límite por correo';
  assert (select count(*) from public.contact_messages where ip_hash = ip) = 10, 'el IP queda con 10 mensajes';

  -- La huella del IP no se guarda más de un día
  insert into public.contact_messages (nombre, email, telefono, mensaje, aceptado_en, created_at, ip_hash)
  values ('Viejo', 'ip-viejo-' || mail, tel, texto, now() - interval '2 days', now() - interval '2 days', ip_viejo)
  returning id into viejo;
  set local role service_role;
  perform public.create_contact_message('Ana Prueba', 'limpieza-' || mail, tel, null, texto, true, null);
  reset role;
  assert (select ip_hash from public.contact_messages where id = viejo) is null, 'la huella de IP de hace más de un día se borra';

  -- ---- Lectura: anónimo, cliente y admin sin 2FA no ven ni editan; el admin con 2FA solo lee --------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform 1 from public.contact_messages; raise exception 'anon no lee mensajes';
  exception when insufficient_privilege then null; end;
  begin insert into public.contact_messages (nombre, email, telefono, mensaje, aceptado_en) values ('Xx', mail2, tel, texto, now());
    raise exception 'anon no inserta mensajes';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  assert (select count(*) from public.contact_messages where id in (m1, m2, m3)) = 0, 'un cliente no ve mensajes';
  begin insert into public.contact_messages (nombre, email, telefono, mensaje, aceptado_en) values ('Xx', mail2, tel, texto, now());
    raise exception 'un cliente no inserta mensajes';
  exception when insufficient_privilege then null; end;
  begin update public.contact_messages set estado = 'leido', leido_en = now() where id = m1; raise exception 'un cliente no edita mensajes';
  exception when insufficient_privilege then null; end;
  begin delete from public.contact_messages where id = m1; raise exception 'un cliente no borra mensajes';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', aal1_claims, true);
  assert (select count(*) from public.contact_messages where id in (m1, m2, m3)) = 0, 'un admin sin 2FA no ve mensajes';
  begin update public.contact_messages set estado = 'leido', leido_en = now() where id = m1; raise exception 'un admin sin 2FA no edita mensajes';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', admin_claims, true);
  assert (select count(*) from public.contact_messages where id in (m1, m2, m3)) = 3, 'el admin con 2FA ve los mensajes';
  select email into seen from public.contact_messages where id = m1;
  assert seen = mail, 'el admin con 2FA lee los datos';
  begin insert into public.contact_messages (nombre, email, telefono, mensaje, aceptado_en) values ('Xx', mail2, tel, texto, now());
    raise exception 'ni el admin inserta mensajes directo';
  exception when insufficient_privilege then null; end;
  begin update public.contact_messages set estado = 'leido', leido_en = now() where id = m1; raise exception 'ni el admin edita mensajes directo';
  exception when insufficient_privilege then null; end;
  begin delete from public.contact_messages where id = m1; raise exception 'ni el admin borra mensajes directo';
  exception when insufficient_privilege then null; end;
  reset role;

  -- ---- Cambios de estado: solo el admin con 2FA y solo desde el estado que corresponde --------------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.admin_mark_message_read(m1); raise exception 'anon no marca leído';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_archive_message(m1); raise exception 'anon no archiva';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin perform public.admin_mark_message_read(m1); raise exception 'un cliente no marca leído';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'leído cliente: ' || sqlerrm; end;
  begin perform public.admin_archive_message(m1); raise exception 'un cliente no archiva';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'archivar cliente: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', aal1_claims, true);
  begin perform public.admin_mark_message_read(m1); raise exception 'un admin sin 2FA no marca leído';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'leído aal1: ' || sqlerrm; end;
  begin perform public.admin_archive_message(m1); raise exception 'un admin sin 2FA no archiva';
  exception when raise_exception then assert sqlerrm = 'no_autorizado', 'archivar aal1: ' || sqlerrm; end;
  reset role;
  assert (select estado from public.contact_messages where id = m1) = 'nuevo', 'los intentos no autorizados no cambian nada';

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin perform public.admin_mark_message_read(ghost); raise exception 'mensaje inexistente';
  exception when raise_exception then assert sqlerrm = 'mensaje_no_encontrado', 'inexistente: ' || sqlerrm; end;
  begin perform public.admin_archive_message(ghost); raise exception 'mensaje inexistente al archivar';
  exception when raise_exception then assert sqlerrm = 'mensaje_no_encontrado', 'archivar inexistente: ' || sqlerrm; end;
  assert public.admin_mark_message_read(m1) = 'leido', 'marcar leído';
  begin perform public.admin_mark_message_read(m1); raise exception 'marcar leído dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'leído dos veces: ' || sqlerrm; end;
  assert public.admin_archive_message(m1) = 'archivado', 'archivar uno leído';
  begin perform public.admin_archive_message(m1); raise exception 'archivar dos veces';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'archivar dos veces: ' || sqlerrm; end;
  begin perform public.admin_mark_message_read(m1); raise exception 'un archivado no vuelve a leído';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'leído un archivado: ' || sqlerrm; end;
  assert public.admin_archive_message(m2) = 'archivado', 'archivar uno nuevo';
  reset role;
  select * into r from public.contact_messages where id = m1;
  assert r.estado = 'archivado' and r.leido_en is not null, 'el leído archivado conserva su fecha de lectura';
  select * into r from public.contact_messages where id = m2;
  assert r.estado = 'archivado' and r.leido_en is not null, 'archivar uno nuevo lo da por leído';
  assert (select estado from public.contact_messages where id = m3) = 'nuevo', 'los demás no cambian';

  -- La tabla no admite estados ni fechas incoherentes (aunque se escriba directo como superusuario)
  begin update public.contact_messages set estado = 'otro' where id = m3; raise exception 'estado desconocido';
  exception when check_violation then null; end;
  begin update public.contact_messages set estado = 'leido' where id = m3; raise exception 'leído sin fecha de lectura';
  exception when check_violation then null; end;

  -- ---- Horario de atención: validación en la base, Configuración y vista pública -------------------
  begin update public.store_settings set horario_atencion = repeat('a', 121); raise exception 'horario de más de 120';
  exception when check_violation then null; end;
  begin update public.store_settings set horario_atencion = '<b>Lunes</b>'; raise exception 'horario con HTML';
  exception when check_violation then null; end;
  begin update public.store_settings set horario_atencion = E'Lunes\nmartes'; raise exception 'horario en dos líneas';
  exception when check_violation then null; end;
  begin update public.store_settings set horario_atencion = ''; raise exception 'horario vacío (debe ser null)';
  exception when check_violation then null; end;

  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  update public.store_settings set horario_atencion = 'Lunes a viernes, 9:00 a 18:00' where id;
  get diagnostics n = row_count;
  assert n = 1, 'el admin con 2FA guarda el horario';
  perform set_config('request.jwt.claims', cust_claims, true);
  update public.store_settings set horario_atencion = 'Cliente' where id;
  get diagnostics n = row_count;
  assert n = 0, 'un cliente no cambia el horario';
  reset role;

  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select horario_atencion into seen from public.store_public_info;
  assert seen = 'Lunes a viernes, 9:00 a 18:00', 'el público lee el horario por la vista';
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- create_order acotado y límite de intentos (migración 21)
-- Se usan usuarios, productos y claves nuevos de esta corrida: los datos reales no cambian el resultado.
-- ---------------------------------------------------------------------------
insert into public.products (id, category_id, nombre, slug, precio, stock)
values ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-000000000001', 'Límite', 'p-limite', 10, 100),
       ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-000000000001', 'Límite 2', 'p-limite-2', 10, 100);

do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  pa constant uuid := '20000000-0000-0000-0000-0000000000d1';
  pb constant uuid := '20000000-0000-0000-0000-0000000000d2';
  u  constant uuid := gen_random_uuid();   -- tope de pendientes
  w  constant uuid := gen_random_uuid();   -- carrito vacío, doble llamada y carrito cambiado
  one_a constant jsonb := '[{"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":1}]';
  run constant text := replace(gen_random_uuid()::text, '-', '');
  k1 constant text := encode(sha256(convert_to('k1-' || run, 'UTF8')), 'hex');
  k2 constant text := encode(sha256(convert_to('k2-' || run, 'UTF8')), 'hex');
  o record;
  orders uuid[] := '{}';
  rs0 integer;
  rs integer;
  ok boolean;
begin
  insert into auth.users (id) values (u), (w);

  -- ---- Tope: 3 pedidos en pendiente_pago por usuario --------------------------------------------
  for i in 1..3 loop
    insert into public.cart_items (user_id, product_id, cantidad) values (u, pa, 1);
    set local role service_role;
    select * into o from public.create_order(u, 'U', 'u@test.ec', '0999999999', '{}'::jsonb, one_a, 10, 0, 0, 0, 10, 48);
    reset role;
    orders := orders || o.o_id;
  end loop;
  assert (select count(*) from public.orders where user_id = u and estado = 'pendiente_pago') = 3, 'tres pendientes permitidos';

  insert into public.cart_items (user_id, product_id, cantidad) values (u, pa, 1);
  select stock_reservado into rs0 from public.products where id = pa;
  set local role service_role;
  begin
    perform public.create_order(u, 'U', 'u@test.ec', '0999999999', '{}'::jsonb, one_a, 10, 0, 0, 0, 10, 48);
    raise exception 'el cuarto pedido pendiente debía rechazarse';
  exception when raise_exception then assert sqlerrm = 'limite_pendientes', 'cuarto pendiente: ' || sqlerrm; end;
  reset role;
  assert (select stock_reservado from public.products where id = pa) = rs0, 'el rechazo no aparta stock';
  assert (select count(*) from public.cart_items where user_id = u) = 1, 'el rechazo no vacía el carrito';

  -- Con un comprobante en revisión el pedido ya no está pendiente de pago: se libera un cupo
  set local role service_role;
  perform public.submit_payment_proof(u, orders[1], 'limite/a.png', repeat('c', 64));
  select * into o from public.create_order(u, 'U', 'u@test.ec', '0999999999', '{}'::jsonb, one_a, 10, 0, 0, 0, 10, 48);
  reset role;
  assert o.o_id is not null, 'con un pedido en revisión, se puede crear otro';

  -- Al cancelar uno, se libera otro cupo
  insert into public.cart_items (user_id, product_id, cantidad) values (u, pa, 1);
  set local role service_role;
  begin
    perform public.create_order(u, 'U', 'u@test.ec', '0999999999', '{}'::jsonb, one_a, 10, 0, 0, 0, 10, 48);
    raise exception 'otra vez en el tope';
  exception when raise_exception then assert sqlerrm = 'limite_pendientes', 'tope otra vez: ' || sqlerrm; end;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', admin_claims, true);
  perform public.admin_cancel_order(orders[2], 'Prueba de tope');
  reset role;
  set local role service_role;
  select * into o from public.create_order(u, 'U', 'u@test.ec', '0999999999', '{}'::jsonb, one_a, 10, 0, 0, 0, 10, 48);
  reset role;
  assert o.o_id is not null, 'al cancelar uno se puede crear otro';

  -- ---- Carrito vacío ------------------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb, one_a, 10, 0, 0, 0, 10, 48);
    raise exception 'sin carrito no hay pedido';
  exception when raise_exception then assert sqlerrm = 'carrito_vacio', 'carrito vacío: ' || sqlerrm; end;
  reset role;

  -- ---- Doble llamada (doble clic, dos pestañas): solo el primero crea el pedido -------------------
  insert into public.cart_items (user_id, product_id, cantidad) values (w, pa, 2);
  select stock_reservado into rs0 from public.products where id = pa;
  set local role service_role;
  perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
    '[{"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":2}]', 20, 0, 0, 0, 20, 48);
  begin
    perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":2}]', 20, 0, 0, 0, 20, 48);
    raise exception 'la segunda llamada no debía crear otro pedido';
  exception when raise_exception then assert sqlerrm = 'carrito_vacio', 'segunda llamada: ' || sqlerrm; end;
  reset role;
  assert (select count(*) from public.orders where user_id = w) = 1, 'un solo pedido';
  select stock_reservado into rs from public.products where id = pa;
  assert rs = rs0 + 2, 'el stock se aparta una sola vez';

  -- ---- Las líneas deben ser exactamente las del carrito -------------------------------------------
  insert into public.cart_items (user_id, product_id, cantidad) values (w, pa, 2), (w, pb, 1);
  set local role service_role;
  -- Otra cantidad
  begin
    perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":1},
        {"product_id":"20000000-0000-0000-0000-0000000000d2","nombre":"Límite 2","precio_unitario":10,"cantidad":1}]', 20, 0, 0, 0, 20, 48);
    raise exception 'otra cantidad que la del carrito';
  exception when raise_exception then assert sqlerrm = 'carrito_cambio', 'otra cantidad: ' || sqlerrm; end;
  -- Falta una línea
  begin
    perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":2}]', 20, 0, 0, 0, 20, 48);
    raise exception 'falta una línea del carrito';
  exception when raise_exception then assert sqlerrm = 'carrito_cambio', 'falta una línea: ' || sqlerrm; end;
  -- Línea repetida en lugar de la otra
  begin
    perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
      '[{"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":2},
        {"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":2}]', 40, 0, 0, 0, 40, 48);
    raise exception 'línea repetida';
  exception when raise_exception then assert sqlerrm = 'carrito_cambio', 'línea repetida: ' || sqlerrm; end;
  -- Identificador que no es uuid
  begin
    perform public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
      '[{"product_id":"no-es-uuid","nombre":"X","precio_unitario":10,"cantidad":2}]', 20, 0, 0, 0, 20, 48);
    raise exception 'producto inválido';
  exception when raise_exception then assert sqlerrm = 'cantidad_invalida', 'producto inválido: ' || sqlerrm; end;
  -- Iguales al carrito (en otro orden): se crea
  select * into o from public.create_order(w, 'W', 'w@test.ec', '0999999999', '{}'::jsonb,
    '[{"product_id":"20000000-0000-0000-0000-0000000000d2","nombre":"Límite 2","precio_unitario":10,"cantidad":1},
      {"product_id":"20000000-0000-0000-0000-0000000000d1","nombre":"Límite","precio_unitario":10,"cantidad":2}]', 30, 0, 0, 0, 30, 48);
  reset role;
  assert o.o_id is not null, 'con las mismas líneas del carrito, el pedido se crea';
  assert (select count(*) from public.cart_items where user_id = w) = 0, 'y el carrito queda vacío';

  -- ---- rate_limit_hit: solo service_role -----------------------------------------------------------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.rate_limit_hit('login_ip', k1, 3, interval '1 hour'); raise exception 'anon no usa rate_limit_hit';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.rate_limits; raise exception 'anon no lee rate_limits';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin perform public.rate_limit_hit('login_ip', k1, 3, interval '1 hour'); raise exception 'un cliente no usa rate_limit_hit';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin perform public.rate_limit_hit('login_ip', k1, 3, interval '1 hour'); raise exception 'ni el admin usa rate_limit_hit';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.rate_limits; raise exception 'ni el admin lee rate_limits';
  exception when insufficient_privilege then null; end;
  begin perform public.cleanup_rate_limits(); raise exception 'el admin no limpia rate_limits';
  exception when insufficient_privilege then null; end;
  reset role;

  -- ---- Límite: 3 por ventana, por bucket y clave ---------------------------------------------------
  set local role service_role;
  begin perform 1 from public.rate_limits; raise exception 'service_role no lee la tabla directo';
  exception when insufficient_privilege then null; end;
  assert public.rate_limit_hit('prueba_rl', k1, 3, interval '1 hour'), 'intento 1';
  assert public.rate_limit_hit('prueba_rl', k1, 3, interval '1 hour'), 'intento 2';
  assert public.rate_limit_hit('prueba_rl', k1, 3, interval '1 hour'), 'intento 3';
  assert not public.rate_limit_hit('prueba_rl', k1, 3, interval '1 hour'), 'el cuarto se rechaza';
  assert not public.rate_limit_hit('prueba_rl', k1, 3, interval '1 hour'), 'y el quinto también';
  assert public.rate_limit_hit('prueba_rl', k2, 3, interval '1 hour'), 'otra clave tiene su propio conteo';
  assert public.rate_limit_hit('prueba_rl_otro', k1, 3, interval '1 hour'), 'otro bucket tiene su propio conteo';

  -- Parámetros inválidos: nunca una clave en claro
  begin perform public.rate_limit_hit('prueba_rl', '190.1.2.3', 3, interval '1 hour'); raise exception 'IP en claro';
  exception when raise_exception then assert sqlerrm = 'parametros_invalidos', 'IP en claro: ' || sqlerrm; end;
  begin perform public.rate_limit_hit('prueba_rl', upper(k1), 3, interval '1 hour'); raise exception 'hex en mayúsculas';
  exception when raise_exception then assert sqlerrm = 'parametros_invalidos', 'mayúsculas: ' || sqlerrm; end;
  begin perform public.rate_limit_hit('Prueba RL', k1, 3, interval '1 hour'); raise exception 'bucket inválido';
  exception when raise_exception then assert sqlerrm = 'parametros_invalidos', 'bucket: ' || sqlerrm; end;
  begin perform public.rate_limit_hit('prueba_rl', k1, 0, interval '1 hour'); raise exception 'máximo 0';
  exception when raise_exception then assert sqlerrm = 'parametros_invalidos', 'máximo: ' || sqlerrm; end;
  begin perform public.rate_limit_hit('prueba_rl', k1, 3, interval '8 days'); raise exception 'ventana muy larga';
  exception when raise_exception then assert sqlerrm = 'parametros_invalidos', 'ventana: ' || sqlerrm; end;
  begin perform public.rate_limit_hit('prueba_rl', k1, 3, null); raise exception 'ventana nula';
  exception when raise_exception then assert sqlerrm = 'parametros_invalidos', 'ventana nula: ' || sqlerrm; end;
  reset role;

  -- Vencida la ventana, se empieza de nuevo (se simula moviendo la ventana al pasado)
  update public.rate_limits set ventana_inicio = now() - interval '2 hours', expira_en = now() - interval '1 hour'
   where bucket = 'prueba_rl' and clave = k1;
  set local role service_role;
  assert public.rate_limit_hit('prueba_rl', k1, 3, interval '1 hour'), 'vencida la ventana, se permite de nuevo';
  reset role;
  assert (select intentos from public.rate_limits where bucket = 'prueba_rl' and clave = k1) = 1, 'el conteo se reinicia';

  -- La limpieza borra solo lo vencido
  update public.rate_limits set ventana_inicio = now() - interval '2 hours', expira_en = now() - interval '1 hour'
   where bucket = 'prueba_rl' and clave = k2;
  perform public.cleanup_rate_limits();
  assert (select count(*) from public.rate_limits where bucket = 'prueba_rl' and clave = k2) = 0, 'la limpieza borra lo vencido';
  assert (select count(*) from public.rate_limits where bucket = 'prueba_rl' and clave = k1) = 1, 'y conserva lo vigente';
  -- La tabla no acepta claves en claro aunque se escriba directo
  begin
    insert into public.rate_limits (bucket, clave, ventana_inicio, expira_en, intentos)
    values ('prueba_rl', 'ana@correo.com', now(), now() + interval '1 hour', 1);
    raise exception 'la tabla no acepta un correo como clave';
  exception when check_violation then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- Registro de correos (migración 22). Todo se compara sobre filas creadas aquí, con claves al azar:
-- los registros reales que haya no cambian el resultado.
-- ---------------------------------------------------------------------------
do $$
declare
  admin_claims constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}';
  aal1_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}';
  cust_claims  constant text := '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  run constant text := replace(gen_random_uuid()::text, '-', '');
  h1 constant text := encode(sha256(convert_to('h1-' || run, 'UTF8')), 'hex');
  h2 constant text := encode(sha256(convert_to('h2-' || run, 'UTF8')), 'hex');
  ref constant text := 'MC-' || run;
  a uuid; b uuid; c uuid; d uuid; e uuid; stale uuid;
  n integer;
begin
  -- ---- Permisos: nadie escribe ni llama a las funciones salvo service_role ---------------------------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform 1 from public.email_log; raise exception 'anon no lee email_log';
  exception when insufficient_privilege then null; end;
  begin perform public.email_log_claim('prueba_a', ref, h1, 'a***@b***.com'); raise exception 'anon no reclama';
  exception when insufficient_privilege then null; end;
  begin perform public.email_log_finish(gen_random_uuid(), 'enviado', null); raise exception 'anon no marca resultados';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  begin perform public.email_log_claim('prueba_a', ref, h1, 'a***@b***.com'); raise exception 'un cliente no reclama';
  exception when insufficient_privilege then null; end;
  begin perform public.email_log_finish(gen_random_uuid(), 'enviado', null); raise exception 'un cliente no marca resultados';
  exception when insufficient_privilege then null; end;
  begin insert into public.email_log (tipo, referencia_id, destinatario_hash, destinatario_mascara, estado)
    values ('prueba_a', ref, h1, 'a***@b***.com', 'enviado'); raise exception 'un cliente no escribe';
  exception when insufficient_privilege then null; end;
  begin update public.email_log set estado = 'enviado'; raise exception 'un cliente no edita';
  exception when insufficient_privilege then null; end;
  begin delete from public.email_log; raise exception 'un cliente no borra';
  exception when insufficient_privilege then null; end;
  begin perform public.cleanup_email_log(); raise exception 'un cliente no limpia';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', admin_claims, true);
  begin perform public.email_log_claim('prueba_a', ref, h1, 'a***@b***.com'); raise exception 'ni el admin reclama por la API';
  exception when insufficient_privilege then null; end;
  begin insert into public.email_log (tipo, referencia_id, destinatario_hash, destinatario_mascara, estado)
    values ('prueba_a', ref, h1, 'a***@b***.com', 'enviado'); raise exception 'ni el admin escribe';
  exception when insufficient_privilege then null; end;
  begin delete from public.email_log; raise exception 'ni el admin borra';
  exception when insufficient_privilege then null; end;
  begin perform public.cleanup_email_log(); raise exception 'ni el admin limpia';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role service_role;
  begin perform 1 from public.email_log; raise exception 'service_role no toca la tabla directo';
  exception when insufficient_privilege then null; end;
  begin perform public.cleanup_email_log(); raise exception 'service_role no limpia';
  exception when insufficient_privilege then null; end;

  -- ---- Reclamar: el primero gana, el repetido recibe null --------------------------------------------
  a := public.email_log_claim('prueba_a', ref, h1, 'a***@b***.com');
  assert a is not null, 'el primer reclamo devuelve un id';
  assert public.email_log_claim('prueba_a', ref, h1, 'a***@b***.com') is null, 'el mismo evento y destinatario es un duplicado';
  assert public.email_log_claim('prueba_a', ref, h1, 'otra***@b***.com') is null, 'cambiar la máscara no evita el duplicado';
  b := public.email_log_claim('prueba_a', ref, h2, 'c***@d***.com');
  assert b is not null, 'otro destinatario del mismo evento es otro reclamo';
  c := public.email_log_claim('prueba_b', ref, h1, 'a***@b***.com');
  assert c is not null, 'otro tipo de correo del mismo pedido es otro reclamo';
  d := public.email_log_claim('prueba_a', ref || '-2', h1, 'a***@b***.com');
  assert d is not null, 'otro evento (otro comprobante) es otro reclamo';

  -- ---- Datos inválidos ---------------------------------------------------------------------------------
  begin perform public.email_log_claim('Tipo Malo', ref, h1, 'a***@b***.com'); raise exception 'tipo inválido';
  exception when check_violation then null; end;
  begin perform public.email_log_claim('prueba_a', ref, 'ana@correo.com', 'a***@b***.com'); raise exception 'el correo en claro no es una huella';
  exception when check_violation then null; end;
  begin perform public.email_log_claim('prueba_a', '', h1, 'a***@b***.com'); raise exception 'referencia vacía';
  exception when check_violation then null; end;

  -- ---- Marcar resultados: solo desde pendiente y solo estados finales ------------------------------
  begin perform public.email_log_finish(a, 'pendiente', null); raise exception 'pendiente no es un resultado';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'resultado inválido: ' || sqlerrm; end;
  begin perform public.email_log_finish(a, 'otro', null); raise exception 'estado desconocido';
  exception when raise_exception then assert sqlerrm = 'estado_invalido', 'estado desconocido: ' || sqlerrm; end;
  perform public.email_log_finish(a, 'enviado', null);
  perform public.email_log_finish(b, 'fallido', repeat('x', 500));
  perform public.email_log_finish(c, 'simulado', null);
  -- Un resultado ya marcado no se pisa
  perform public.email_log_finish(a, 'fallido', 'tarde');
  reset role;

  assert (select estado from public.email_log where id = a) = 'enviado', 'un resultado ya marcado no se cambia';
  assert (select estado from public.email_log where id = b) = 'fallido', 'fallido';
  assert char_length((select error from public.email_log where id = b)) = 300, 'el error se recorta a 300';
  assert (select estado from public.email_log where id = c) = 'simulado', 'simulado';
  assert (select estado from public.email_log where id = d) = 'pendiente', 'sin marcar sigue pendiente';

  -- Un enviado, fallido o simulado no se vuelve a reclamar; un pendiente reciente tampoco
  set local role service_role;
  assert public.email_log_claim('prueba_a', ref, h2, 'c***@d***.com') is null, 'un fallido no se reenvía solo';
  assert public.email_log_claim('prueba_b', ref, h1, 'a***@b***.com') is null, 'un simulado no se reenvía';
  assert public.email_log_claim('prueba_a', ref || '-2', h1, 'a***@b***.com') is null, 'un pendiente reciente no se reclama otra vez';
  reset role;

  -- Un reclamo abandonado (pendiente de hace más de 10 minutos) se puede recuperar
  update public.email_log set creado_en = now() - interval '11 minutes' where id = d;
  set local role service_role;
  e := public.email_log_claim('prueba_a', ref || '-2', h1, 'a***@b***.com');
  reset role;
  assert e = d, 'el reclamo abandonado se recupera con el mismo id';

  -- ---- Lectura: anónimo no; cliente y admin sin 2FA no ven nada; el admin con 2FA sí --------------
  set local role authenticated;
  perform set_config('request.jwt.claims', cust_claims, true);
  assert (select count(*) from public.email_log where tipo like 'prueba\_%') = 0, 'un cliente no ve registros';
  perform set_config('request.jwt.claims', aal1_claims, true);
  assert (select count(*) from public.email_log where tipo like 'prueba\_%') = 0, 'un admin sin 2FA no ve registros';
  perform set_config('request.jwt.claims', admin_claims, true);
  assert (select count(*) from public.email_log where tipo like 'prueba\_%' and referencia_id like ref || '%') = 4, 'el admin con 2FA ve los 4 registros';
  reset role;

  -- ---- Limpieza: borra lo de más de 90 días y conserva lo reciente --------------------------------
  insert into public.email_log (tipo, referencia_id, destinatario_hash, destinatario_mascara, estado, creado_en)
  values ('prueba_vieja', ref, h1, 'a***@b***.com', 'enviado', now() - interval '91 days')
  returning id into stale;
  n := public.cleanup_email_log();
  assert n >= 1, 'la limpieza borró algo';
  assert (select count(*) from public.email_log where id = stale) = 0, 'se borró el de 91 días';
  assert (select count(*) from public.email_log where id = a) = 1, 'se conservó el reciente';
end $$;

rollback;

select 'RLS OK' as resultado;
