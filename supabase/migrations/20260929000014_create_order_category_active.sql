-- create_order: un producto de una categoría desactivada no se puede comprar.
--
-- Una categoría desactivada (o con el padre desactivado) oculta sus productos de la tienda por RLS.
-- Pero `create_order` la ejecuta el servidor con service_role, que SE SALTA RLS: si un producto ya estaba
-- en el carrito de una cuenta cuando se desactivó su categoría, el servidor podría leerlo y venderlo.
-- Por eso la función vuelve a comprobarlo ella misma, igual que comprueba `activo` y el stock.
-- (Es la misma función de la migración 9 con esa condición añadida.)

create or replace function public.create_order(
  p_user_id uuid,
  p_nombre text,
  p_email text,
  p_telefono text,
  p_direccion jsonb,
  -- [{ "product_id": uuid, "nombre": text, "precio_unitario": numeric, "cantidad": int }]
  p_items jsonb,
  p_subtotal numeric,
  p_descuento numeric,
  p_descuento_transferencia numeric,
  p_envio numeric,
  p_total numeric,
  p_horas_limite integer
)
returns table (o_id uuid, o_referencia text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line record;
  v_disponible integer;
  v_order_id uuid;
  v_ref text;
begin
  -- Cuenta obligatoria: todo pedido pertenece a un usuario.
  if p_user_id is null then
    raise exception 'cuenta_requerida' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'items_invalidos' using errcode = 'P0001';
  end if;
  if p_horas_limite is null or p_horas_limite not between 1 and 336 then
    raise exception 'plazo_invalido' using errcode = 'P0001';
  end if;

  -- Cada línea debe traer producto y una cantidad entera mayor que 0 (y dentro del máximo por línea).
  if exists (
    select 1
    from jsonb_array_elements(p_items) as i
    where jsonb_typeof(i -> 'product_id') is distinct from 'string'
       or jsonb_typeof(i -> 'cantidad') is distinct from 'number'
       -- CASE: el cast solo se evalúa si el texto son dígitos (OR no garantiza el orden).
       or not coalesce(
            case when (i ->> 'cantidad') ~ '^[0-9]{1,9}$'
                 then (i ->> 'cantidad')::integer between 1 and 100
            end,
            false)
  ) then
    raise exception 'cantidad_invalida' using errcode = 'P0001';
  end if;

  -- Se recorren en orden de id para que dos pedidos con los mismos productos no se bloqueen entre sí.
  for v_line in
    select (i ->> 'product_id')::uuid as product_id, (i ->> 'cantidad')::integer as cantidad
    from jsonb_array_elements(p_items) as i
    order by 1
  loop
    select p.stock - p.stock_reservado into v_disponible
    from public.products p
    -- El producto debe estar activo Y su categoría visible en la tienda (activa, y su padre también).
    -- Esto se comprueba aquí y no solo por RLS: esta función corre con permisos del servidor, que se
    -- saltan RLS, y un producto de una categoría desactivada no se debe poder comprar.
    where p.id = v_line.product_id and p.activo and public.category_visible(p.category_id)
    for update;

    if not found or v_disponible < v_line.cantidad then
      raise exception 'stock_insuficiente' using errcode = 'P0001', detail = v_line.product_id::text;
    end if;

    update public.products
       set stock_reservado = stock_reservado + v_line.cantidad
     where id = v_line.product_id;
  end loop;

  insert into public.orders (
    user_id, contacto_nombre, contacto_email, contacto_telefono, direccion_envio,
    subtotal, descuento, descuento_transferencia, envio, total, vence_en
  ) values (
    p_user_id, p_nombre, p_email, p_telefono, p_direccion,
    p_subtotal, p_descuento, p_descuento_transferencia, p_envio, p_total,
    now() + make_interval(hours => p_horas_limite)
  )
  returning id, referencia into v_order_id, v_ref;

  insert into public.order_items (order_id, product_id, nombre, precio_unitario, cantidad)
  select v_order_id, (i ->> 'product_id')::uuid, i ->> 'nombre',
         (i ->> 'precio_unitario')::numeric, (i ->> 'cantidad')::integer
  from jsonb_array_elements(p_items) as i;

  -- Pedido creado: se vacía el carrito de la cuenta.
  delete from public.cart_items where user_id = p_user_id;

  return query select v_order_id, v_ref;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  to service_role;
