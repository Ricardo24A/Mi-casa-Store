-- Base del flujo del pedido: comprobante de pago, restricciones de stock y validación de cantidades.

-- ---------------------------------------------------------------------------
-- 1) La reserva de stock nunca es negativa ni supera el stock
-- ---------------------------------------------------------------------------
-- Ambas restricciones ya existen desde el esquema inicial (`stock_reservado >= 0` en la columna y
-- `products_reserva_valida`). Se comprueba y solo se agrega la que falte, sin duplicar.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stock_reservado >= 0%'
  ) then
    alter table public.products
      add constraint products_reserva_no_negativa check (stock_reservado >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stock_reservado <= stock%'
  ) then
    alter table public.products
      add constraint products_reserva_valida check (stock_reservado <= stock);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) create_order: valida que cada cantidad sea > 0 (y no pase de 100)
-- ---------------------------------------------------------------------------
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

  -- Pedido creado: se vacía el carrito de la cuenta.
  delete from public.cart_items where user_id = p_user_id;

  return query select v_order_id, v_ref;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) Comprobantes: el bucket privado admite hasta 4 MB (límite de las funciones de Vercel)
-- ---------------------------------------------------------------------------
update storage.buckets set file_size_limit = 4194304 where id = 'payment-proofs';

-- ---------------------------------------------------------------------------
-- 4) submit_payment_proof: adjunta el comprobante y pasa el pedido a 'comprobante_recibido'
-- ---------------------------------------------------------------------------
-- La llama SOLO el servidor (service_role) después de comprobar la sesión, validar el tipo real
-- del archivo y subirlo al bucket privado. En una sola transacción y con el pedido bloqueado:
--   · el pedido debe ser del usuario y estar 'pendiente_pago' (no se sube dos veces);
--   · no debe haber vencido (aunque el cron aún no lo haya marcado);
--   · se guarda el comprobante y el estado cambia (el trigger orders_require_proof lo permite
--     porque el comprobante ya existe).
-- Devuelve si el mismo archivo (hash) ya se usó en OTRO pedido, para avisar al dueño.
create function public.submit_payment_proof(
  p_user_id uuid,
  p_order_id uuid,
  p_archivo text,
  p_hash text
)
returns table (o_proof_id uuid, o_duplicado boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_proof_id uuid;
  v_duplicado boolean;
begin
  if p_user_id is null then
    raise exception 'cuenta_requerida' using errcode = 'P0001';
  end if;

  select o.id, o.user_id, o.estado, o.vence_en into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  -- Mismo error para "no existe" y "es de otro": no revela pedidos ajenos.
  if not found or v_order.user_id is distinct from p_user_id then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;
  if v_order.estado <> 'pendiente_pago' then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;
  if v_order.vence_en <= now() then
    raise exception 'pedido_vencido' using errcode = 'P0001';
  end if;

  v_duplicado := exists (
    select 1 from public.payment_proofs pp where pp.hash = p_hash and pp.order_id <> p_order_id
  );

  insert into public.payment_proofs (order_id, archivo, hash)
  values (p_order_id, p_archivo, p_hash)
  returning id into v_proof_id;

  update public.orders set estado = 'comprobante_recibido' where id = p_order_id;

  return query select v_proof_id, v_duplicado;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_payment_proof(uuid, uuid, text, text) to service_role;
