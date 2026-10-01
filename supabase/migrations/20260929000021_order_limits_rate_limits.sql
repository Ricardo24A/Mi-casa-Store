-- Pedidos acotados y límite de intentos.
--
-- 1) create_order (misma función de la migración 14, con tres cambios):
--    · Como máximo 3 pedidos en `pendiente_pago` por usuario: una cuenta no puede apartar todo el stock.
--    · Lee y BLOQUEA el carrito de la cuenta (`cart_items ... for update`) y exige que las líneas que
--      envía el servidor sean exactamente las del carrito. Si el carrito está vacío, falla. Como el
--      pedido vacía el carrito en la misma transacción, un segundo envío simultáneo (doble clic, dos
--      pestañas) espera al primero, encuentra el carrito vacío y no crea un segundo pedido.
--    · Un bloqueo por usuario (advisory lock) al inicio: el conteo de pendientes no se puede saltar
--      con dos llamadas a la vez.
--    Se mantiene todo lo demás: categoría visible, reserva atómica y bloqueo de productos en orden de id.
--
-- 2) rate_limits + rate_limit_hit(): límite de intentos por ventana de tiempo para las acciones de
--    servidor (login, registro, recuperar contraseña, código 2FA, crear pedido, subir comprobante).
--    Solo la ejecuta service_role. La clave es SIEMPRE una huella HMAC calculada en el servidor (de un
--    IP, un correo o un usuario), nunca el dato en claro. pg_cron borra las filas vencidas cada hora.

-- ---------------------------------------------------------------------------
-- 1) create_order
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
  v_cart_lines integer;
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
       or (i ->> 'product_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
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

  -- Un pedido a la vez por usuario: el resto espera aquí hasta que este termine.
  perform pg_advisory_xact_lock(hashtextextended('create_order:' || p_user_id::text, 0));

  -- Tope de pedidos esperando pago (los que tienen comprobante en revisión no cuentan: ya pagaron).
  if (select count(*) from public.orders o
      where o.user_id = p_user_id and o.estado = 'pendiente_pago') >= 3 then
    raise exception 'limite_pendientes' using errcode = 'P0001';
  end if;

  -- El carrito de la cuenta, bloqueado hasta el final de la transacción.
  select count(*) into v_cart_lines
  from (select 1 from public.cart_items c where c.user_id = p_user_id order by c.product_id for update) as bloqueadas;
  if v_cart_lines = 0 then
    raise exception 'carrito_vacio' using errcode = 'P0001';
  end if;

  -- Las líneas del pedido deben ser exactamente las del carrito (mismos productos y cantidades, sin
  -- repetidos). Si el carrito cambió mientras el cliente confirmaba, se pide revisarlo de nuevo.
  -- Mismo número de líneas + ningún producto repetido + todas están en el carrito = son iguales.
  if jsonb_array_length(p_items) <> v_cart_lines
     or (select count(distinct (i ->> 'product_id')::uuid) from jsonb_array_elements(p_items) as i) <> v_cart_lines
     or exists (
       select (i ->> 'product_id')::uuid, (i ->> 'cantidad')::integer
       from jsonb_array_elements(p_items) as i
       except
       select c.product_id, c.cantidad from public.cart_items c where c.user_id = p_user_id
     ) then
    raise exception 'carrito_cambio' using errcode = 'P0001';
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
    -- Esta función corre con permisos del servidor, que se saltan RLS.
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

  -- Pedido creado: se vacía el carrito de la cuenta (las filas ya están bloqueadas por esta transacción).
  delete from public.cart_items where user_id = p_user_id;

  return query select v_order_id, v_ref;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) Límite de intentos
-- ---------------------------------------------------------------------------
-- Ventana fija por (bucket, clave): `intentos` cuenta los permitidos desde `ventana_inicio`; al pasar
-- `expira_en` la ventana empieza de nuevo. Los intentos rechazados no suman.
create table public.rate_limits (
  bucket text not null check (bucket ~ '^[a-z0-9_]{1,40}$'),
  -- HMAC-SHA256 en hexadecimal (64 caracteres): nunca un IP, correo o id en claro.
  clave text not null check (clave ~ '^[a-f0-9]{64}$'),
  ventana_inicio timestamptz not null,
  expira_en timestamptz not null,
  intentos integer not null check (intentos >= 1),
  primary key (bucket, clave),
  constraint rate_limits_ventana check (expira_en > ventana_inicio)
);

create index rate_limits_expira_idx on public.rate_limits (expira_en);

alter table public.rate_limits enable row level security;
-- Nadie la lee ni la escribe por la API (tampoco service_role): solo las funciones de abajo.
revoke all on public.rate_limits from public, anon, authenticated, service_role;

-- ¿Se permite un intento más? true = sí (y lo cuenta); false = se alcanzó el máximo en la ventana.
-- El advisory lock por (bucket, clave) evita que dos intentos simultáneos lean el mismo conteo.
create function public.rate_limit_hit(p_bucket text, p_clave text, p_max integer, p_ventana interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.rate_limits%rowtype;
begin
  if p_bucket is null or p_bucket !~ '^[a-z0-9_]{1,40}$'
     or p_clave is null or p_clave !~ '^[a-f0-9]{64}$'
     or p_max is null or p_max not between 1 and 10000
     or p_ventana is null or p_ventana < interval '1 second' or p_ventana > interval '7 days' then
    raise exception 'parametros_invalidos' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rate_limit:' || p_bucket || ':' || p_clave, 0));

  select * into v_row from public.rate_limits r where r.bucket = p_bucket and r.clave = p_clave;

  if not found or v_row.expira_en <= now() then
    insert into public.rate_limits (bucket, clave, ventana_inicio, expira_en, intentos)
    values (p_bucket, p_clave, now(), now() + p_ventana, 1)
    on conflict (bucket, clave) do update
      set ventana_inicio = excluded.ventana_inicio, expira_en = excluded.expira_en, intentos = 1;
    return true;
  end if;

  if v_row.intentos >= p_max then
    return false;
  end if;

  update public.rate_limits set intentos = intentos + 1 where bucket = p_bucket and clave = p_clave;
  return true;
end;
$$;

-- Borra las ventanas vencidas. La llama pg_cron cada hora; devuelve cuántas borró.
create function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.rate_limits where expira_en < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, interval) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_rate_limits() from public, anon, authenticated, service_role;
grant execute on function public.rate_limit_hit(text, text, integer, interval) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Cron de limpieza (mismo patrón que expire-orders, migración 11)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cleanup-rate-limits', '17 * * * *', 'select public.cleanup_rate_limits()');
  else
    raise notice 'pg_cron no está activo: activa la extensión y vuelve a ejecutar este bloque para limpiar rate_limits.';
  end if;
end $$;
