-- Vencimiento automático de pedidos sin comprobante, y la contabilidad de la reserva de stock.
--
-- Reserva de stock: `create_order` suma las unidades a products.stock_reservado. Una reserva se
-- libera una sola vez por pedido: al vencer, cancelar o rechazar (vuelve a stock disponible), o se
-- consume al aprobar el pago (baja el stock definitivo y la reserva). `orders.reserva_activa` dice
-- si el pedido TIENE reservadas sus unidades; nadie libera o consume si ya es false, así que una
-- doble liberación es imposible aunque se repita una llamada o se crucen dos procesos.

-- ---------------------------------------------------------------------------
-- 1) Columnas del pedido
-- ---------------------------------------------------------------------------
alter table public.orders
  add column reserva_activa boolean not null default true,
  -- Motivo de una cancelación, rechazo o vencimiento (se muestra al cliente).
  add column motivo_estado text check (motivo_estado is null or char_length(motivo_estado) <= 500);

-- Pedidos que ya estaban en un estado sin reserva no la tienen activa. (Antes de esta migración
-- nada liberaba reservas: si hubiera pedidos reales cancelados o vencidos con stock apartado, hay que
-- conciliarlos a mano: products.stock_reservado debe ser igual a la suma de las unidades de los
-- pedidos con reserva_activa.)
update public.orders
   set reserva_activa = false
 where estado in ('pagado', 'enviado', 'entregado', 'rechazado', 'cancelado', 'vencido');

-- Un pedido con la reserva liberada no puede volver a tenerla.
create function public.orders_reserva_no_reactivar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.reserva_activa = false and new.reserva_activa = true then
    raise exception 'reserva_ya_liberada' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orders_reserva_guard
  before update of reserva_activa on public.orders
  for each row execute function public.orders_reserva_no_reactivar();

-- ---------------------------------------------------------------------------
-- 2) Liberar y consumir la reserva (internas: las usan las funciones de cambio de estado)
-- ---------------------------------------------------------------------------
-- Las dos EXIGEN que el pedido ya esté bloqueado (`for update`) por quien las llama. Bloquean los
-- productos en orden de id para que dos pedidos con los mismos productos no se queden esperando.

-- Libera la reserva: las unidades vuelven a estar disponibles.
create function public.order_release_reservation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select o.reserva_activa from public.orders o where o.id = p_order_id), false) then
    return; -- ya liberada (o consumida): no se hace nada
  end if;

  perform 1
  from public.products p
  where p.id in (select oi.product_id from public.order_items oi where oi.order_id = p_order_id and oi.product_id is not null)
  order by p.id
  for update;

  update public.products p
     set stock_reservado = p.stock_reservado - s.cantidad
    from (
      select oi.product_id, sum(oi.cantidad)::integer as cantidad
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
      group by oi.product_id
    ) s
   where p.id = s.product_id;

  update public.orders set reserva_activa = false where id = p_order_id;
end;
$$;

-- Consume la reserva al aprobar el pago: baja el stock y la reserva a la vez.
create function public.order_consume_reservation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select o.reserva_activa from public.orders o where o.id = p_order_id), false) then
    raise exception 'reserva_inconsistente' using errcode = 'P0001';
  end if;

  perform 1
  from public.products p
  where p.id in (select oi.product_id from public.order_items oi where oi.order_id = p_order_id and oi.product_id is not null)
  order by p.id
  for update;

  update public.products p
     set stock = p.stock - s.cantidad,
         stock_reservado = p.stock_reservado - s.cantidad
    from (
      select oi.product_id, sum(oi.cantidad)::integer as cantidad
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id is not null
      group by oi.product_id
    ) s
   where p.id = s.product_id;

  update public.orders set reserva_activa = false where id = p_order_id;
end;
$$;

revoke all on function public.order_release_reservation(uuid) from public, anon, authenticated, service_role;
revoke all on function public.order_consume_reservation(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Vencimiento automático
-- ---------------------------------------------------------------------------
-- Pasa a 'vencido' los pedidos PENDIENTES DE PAGO (sin comprobante vigente) cuyo plazo ya pasó y
-- libera su reserva. Un pedido con comprobante en revisión no vence: lo resuelve el dueño.
-- Idempotente: solo toca pedidos que siguen pendientes; repetirla no hace nada. Segura ante corridas
-- simultáneas (`skip locked`) y ante una subida de comprobante en curso (esa bloquea el pedido).
-- Devuelve cuántos venció.
create function public.expire_orders(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'limite_invalido' using errcode = 'P0001';
  end if;

  for v_order in
    select o.id
    from public.orders o
    where o.estado = 'pendiente_pago' and o.vence_en <= now()
    order by o.vence_en
    limit p_limit
    for update skip locked
  loop
    perform public.order_release_reservation(v_order.id);
    update public.orders
       set estado = 'vencido', motivo_estado = 'Venció el plazo de pago'
     where id = v_order.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_orders(integer) from public, anon, authenticated;
grant execute on function public.expire_orders(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Cron: cada 5 minutos
-- ---------------------------------------------------------------------------
-- Usa la extensión pg_cron de Supabase (Database → Extensions). Si no se puede activar aquí, la
-- migración sigue y avisa; se puede activar en el panel y volver a ejecutar solo este bloque.
-- cron.schedule con el mismo nombre actualiza el trabajo, así que repetirlo no lo duplica.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron no está disponible (%). Actívala en Supabase → Database → Extensions y vuelve a ejecutar este bloque.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-orders', '*/5 * * * *', 'select public.expire_orders()');
  end if;
end $$;
