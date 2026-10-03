-- LIMPIEZA de los datos creados por las pruebas de ataque (todo lleva el prefijo "zz-sec-").
--
--   * SOLO para el proyecto de DESARROLLO. NO se ejecuta automáticamente: tú lo revisas y lo corres en el SQL Editor.
--   * Está dentro de una transacción que termina en ROLLBACK: la primera vez no borra nada y solo muestra los
--     conteos. Cuando los números te parezcan bien, cambia la última línea a COMMIT y vuelve a correrlo.
--   * Solo toca filas identificables por el prefijo de las pruebas. No toca cuentas de usuario, ni productos,
--     categorías, descuentos o pedidos reales.

begin;

-- 1) Pedidos de prueba: los que tienen alguna línea cuyo nombre empieza por "zz-sec-".
create temp table zz_orders on commit drop as
  select distinct o.id, o.referencia
  from public.orders o
  join public.order_items i on i.order_id = o.id
  where i.nombre like 'zz-sec-%';

create temp table zz_products on commit drop as
  select id from public.products where slug like 'zz-sec-%';

create temp table zz_proofs on commit drop as
  select id, archivo from public.payment_proofs where order_id in (select id from zz_orders);

create temp table zz_messages on commit drop as
  select id from public.contact_messages where email like 'zz-sec-%' or nombre like 'zz-sec%';

-- Vista previa (qué se va a borrar)
select 'pedidos de prueba' as que, count(*) as filas from zz_orders
union all select 'comprobantes de esos pedidos', count(*) from zz_proofs
union all select 'productos de prueba', count(*) from zz_products
union all select 'categorías de prueba', count(*) from public.categories where slug like 'zz-sec-%'
union all select 'descuentos de prueba', count(*) from public.discounts where nombre like 'zz-sec-%'
union all select 'carritos con productos de prueba', count(*) from public.cart_items where product_id in (select id from zz_products)
union all select 'direcciones de prueba', count(*) from public.customer_addresses where etiqueta like 'zz-sec-%'
union all select 'mensajes de contacto de prueba', count(*) from zz_messages;

-- 2) Registro de correos simulados que dejaron esos pedidos, comprobantes y mensajes.
delete from public.email_log
 where referencia_id in (select referencia from zz_orders)
    or referencia_id in (select id::text from zz_orders)
    or referencia_id in (select id::text from zz_proofs)
    or referencia_id in (select id::text from zz_messages);

-- 3) Pedidos (sus líneas y comprobantes se borran en cascada). Antes, que no queden reservas colgadas
--    en productos que NO sean de prueba (los de prueba se borran más abajo).
update public.products p
   set stock_reservado = greatest(p.stock_reservado - r.unidades, 0)
  from (
    select i.product_id, sum(i.cantidad)::int as unidades
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where o.id in (select id from zz_orders) and o.reserva_activa and i.product_id not in (select id from zz_products)
    group by i.product_id
  ) r
 where p.id = r.product_id;

delete from public.orders where id in (select id from zz_orders);

-- 4) Carritos, descuentos, productos (sus imágenes en cascada) y categorías de prueba. Primero las
--    subcategorías y luego sus padres.
delete from public.cart_items where product_id in (select id from zz_products);
delete from public.discounts where nombre like 'zz-sec-%';
delete from public.products where id in (select id from zz_products);
delete from public.categories where slug like 'zz-sec-%' and parent_id is not null;
delete from public.categories where slug like 'zz-sec-%' and parent_id is null;

-- 5) Direcciones y mensajes de contacto de prueba.
delete from public.customer_addresses where etiqueta like 'zz-sec-%';
delete from public.contact_messages where id in (select id from zz_messages);

-- 6) El nombre que el checkout de prueba pudo copiar al perfil de las cuentas de prueba (solo si empieza por el prefijo).
update public.profiles set full_name = null where full_name like 'zz-sec%';

-- Lo que este SQL NO borra, a propósito:
--   * rate_limits: las claves son huellas HMAC (no hay forma de reconocerlas) y vencen solas; pg_cron las limpia cada hora.
--   * Archivos de Storage: borrar filas de storage.objects por SQL deja el archivo huérfano en el disco. Bórralos desde
--     el panel de Storage de Supabase o por la API. Esta consulta los lista:
select bucket_id, name, created_at
from storage.objects
where (bucket_id = 'payment-proofs' and (name like 'zz-sec-%' or name in (select archivo from zz_proofs)))
   or (bucket_id = 'product-images' and name like 'zz-sec-%')
order by bucket_id, name;

-- Cuando los conteos de arriba sean los esperados, cambia ROLLBACK por COMMIT:
rollback;
