-- Carrito de la cuenta en la base de datos.
--
-- Con sesión, el carrito vive aquí, ligado al usuario: se conserva al cerrar sesión, al limpiar
-- el navegador y entre dispositivos. El invitado sigue usando localStorage y se fusiona al entrar.
-- Solo producto y cantidad: NUNCA precios ni nombres (los calcula siempre el servidor).

create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  cantidad integer not null check (cantidad between 1 and 99),
  -- Solo para mostrar las líneas en el orden en que se agregaron.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create trigger cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- Máximo 50 productos distintos por usuario (igual que create_order). El trigger corre también en
-- INSERT ... ON CONFLICT, así que una línea que ya existe no cuenta como nueva.
create function public.cart_items_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.cart_items
    where user_id = new.user_id and product_id = new.product_id
  ) then
    return new;
  end if;
  if (select count(*) from public.cart_items where user_id = new.user_id) >= 50 then
    raise exception 'Máximo 50 productos distintos en el carrito' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger cart_items_limit
  before insert on public.cart_items
  for each row execute function public.cart_items_limit();

alter table public.cart_items enable row level security;

revoke all on public.cart_items from anon, authenticated;
revoke all on function public.cart_items_limit() from public, anon, authenticated;
-- anon: nada. authenticated: solo sus filas (la política). service_role: el checkout vacía el carrito.
grant select, insert, update, delete on public.cart_items to authenticated;
grant all on public.cart_items to service_role;

create policy cart_items_owner on public.cart_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- create_order: igual que en la migración anterior, más un paso al final: al crear el pedido con
-- éxito se vacían las líneas del carrito de esa cuenta, en la misma transacción.
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

-- create or replace conserva los permisos, pero se dejan explícitos por claridad.
revoke all on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, jsonb, jsonb, numeric, numeric, numeric, numeric, numeric, integer)
  to service_role;
