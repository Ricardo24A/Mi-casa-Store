-- Creación atómica de pedidos (checkout con cuenta obligatoria).
--
-- La llama SOLO el servidor de Next.js con service_role, después de comprobar la sesión y de
-- recalcular precios, descuentos, envío y total desde la base de datos. Esta función hace lo que
-- no se puede hacer de forma segura desde varias consultas sueltas: bloquear los productos,
-- comprobar el stock disponible, apartarlo (stock_reservado) y crear el pedido con sus líneas en
-- una sola transacción, de modo que dos compras simultáneas no vendan la misma unidad.

create function public.create_order(
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

  -- Se recorren en orden de id para que dos pedidos con los mismos productos no se bloqueen entre sí.
  for v_line in
    select (i ->> 'product_id')::uuid as product_id, (i ->> 'cantidad')::integer as cantidad
    from jsonb_array_elements(p_items) as i
    order by 1
  loop
    select p.stock - p.stock_reservado into v_disponible
    from public.products p
    where p.id = v_line.product_id and p.activo
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

  return query select v_order_id, v_ref;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  to service_role;
