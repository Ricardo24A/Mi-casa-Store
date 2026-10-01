-- Envío y entrega de pedidos, y los datos del Resumen del panel.
--
-- Mismo patrón que aprobar y rechazar (migración 12): CADA cambio de estado es UNA función que
--   1. comprueba que quien llama es el administrador con 2FA (is_admin(): rol admin + aal2);
--   2. BLOQUEA el pedido (`for update`) antes de mirar nada;
--   3. verifica el estado ANTERIOR, así que repetir la llamada o cruzarse con otra falla limpio;
--   4. cambia el estado y guarda la fecha.
-- El estado nunca se cambia con un UPDATE directo desde la API (el permiso se quitó en la 12; las
-- columnas nuevas tampoco son editables por la API).
--
--   marcar enviado     pagado  -> enviado
--   marcar entregado   enviado -> entregado
--
-- Si se agregan cambios de estado, hay que actualizar también la tabla de CLAUDE.md (sección 8).

-- ---------------------------------------------------------------------------
-- 1) Fechas de cada paso
-- ---------------------------------------------------------------------------
-- `pagado_en` es cuándo se aprobó el pago: las ventas de hoy y del mes se cuentan por esa fecha
-- (no por la de creación del pedido, que puede ser de otro día).
alter table public.orders
  add column pagado_en timestamptz,
  add column enviado_en timestamptz,
  add column entregado_en timestamptz;

-- Pedidos que ya estaban pagados: se usa la fecha de aprobación del comprobante y, si no hay, la
-- última modificación del pedido.
update public.orders o
   set pagado_en = coalesce(
     (select max(pp.revisado_en) from public.payment_proofs pp where pp.order_id = o.id and pp.estado = 'aprobado'),
     o.updated_at)
 where o.estado in ('pagado', 'enviado', 'entregado') and o.pagado_en is null;

-- ---------------------------------------------------------------------------
-- 2) Aprobar el pago: ahora también guarda la fecha de pago
-- ---------------------------------------------------------------------------
-- Es la misma función de la migración 12 con `pagado_en = now()` al final.
create or replace function public.admin_approve_order(p_order_id uuid, p_proof_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_proof record;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;

  select o.id, o.estado into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;
  if v_order.estado <> 'comprobante_recibido' then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  select pp.id, pp.estado into v_proof
  from public.payment_proofs pp
  where pp.id = p_proof_id and pp.order_id = p_order_id
  for update;
  if not found then
    raise exception 'comprobante_no_encontrado' using errcode = 'P0001';
  end if;
  if v_proof.estado <> 'en_revision' then
    raise exception 'comprobante_no_vigente' using errcode = 'P0001';
  end if;

  update public.payment_proofs
     set estado = 'aprobado', revisado_por = (select auth.uid()), revisado_en = now()
   where id = p_proof_id;

  perform public.order_consume_reservation(p_order_id);

  update public.orders set estado = 'pagado', pagado_en = now() where id = p_order_id;
  return 'pagado';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Marcar enviado y marcar entregado
-- ---------------------------------------------------------------------------
create function public.admin_mark_shipped(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.order_status;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;

  select o.estado into v_estado from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;
  if v_estado <> 'pagado' then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  update public.orders set estado = 'enviado', enviado_en = now() where id = p_order_id;
  return 'enviado';
end;
$$;

create function public.admin_mark_delivered(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.order_status;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;

  select o.estado into v_estado from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;
  if v_estado <> 'enviado' then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  update public.orders set estado = 'entregado', entregado_en = now() where id = p_order_id;
  return 'entregado';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Datos del Resumen
-- ---------------------------------------------------------------------------
-- Pedidos por estado y ventas de hoy y del mes, con el día y el mes de Ecuador. "Ventas" cuenta solo
-- pedidos con el pago aprobado (pagado, enviado o entregado), por la fecha en que se aprobó.
create function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'America/Guayaquil') at time zone 'America/Guayaquil';
  v_month timestamptz := date_trunc('month', now() at time zone 'America/Guayaquil') at time zone 'America/Guayaquil';
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'estados', (
      select coalesce(jsonb_object_agg(s.estado, s.n), '{}'::jsonb)
      from (select o.estado::text as estado, count(*) as n from public.orders o group by o.estado) s
    ),
    'hoy', (
      select jsonb_build_object('pedidos', count(*), 'total', coalesce(sum(o.total), 0))
      from public.orders o
      where o.estado in ('pagado', 'enviado', 'entregado') and o.pagado_en >= v_today
    ),
    'mes', (
      select jsonb_build_object('pedidos', count(*), 'total', coalesce(sum(o.total), 0))
      from public.orders o
      where o.estado in ('pagado', 'enviado', 'entregado') and o.pagado_en >= v_month
    )
  );
end;
$$;

-- Productos activos agotados (stock 0) o con poco stock: lo DISPONIBLE (stock menos lo reservado por
-- pedidos) es menor o igual que el umbral de Configuración. Devuelve el total y los primeros `p_limit`.
create function public.admin_stock_alerts(p_limit integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 50);
  v_umbral integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;
  select s.umbral_stock_bajo into v_umbral from public.store_settings s;
  v_umbral := coalesce(v_umbral, 5);

  return jsonb_build_object(
    'umbral', v_umbral,
    'agotados', jsonb_build_object(
      'total', (select count(*) from public.products p where p.activo and p.stock = 0),
      'items', coalesce((
        select jsonb_agg(x order by x.nombre)
        from (
          select p.id, p.nombre, p.stock, p.stock_reservado
          from public.products p where p.activo and p.stock = 0
          order by p.nombre limit v_limit
        ) x
      ), '[]'::jsonb)
    ),
    'poco', jsonb_build_object(
      'total', (select count(*) from public.products p
                where p.activo and p.stock > 0 and p.stock - p.stock_reservado <= v_umbral),
      'items', coalesce((
        select jsonb_agg(x order by x.disponible, x.nombre)
        from (
          select p.id, p.nombre, p.stock, p.stock_reservado, p.stock - p.stock_reservado as disponible
          from public.products p
          where p.activo and p.stock > 0 and p.stock - p.stock_reservado <= v_umbral
          order by p.stock - p.stock_reservado, p.nombre limit v_limit
        ) x
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Permisos: solo sesiones autenticadas, y cada función comprueba is_admin()
-- ---------------------------------------------------------------------------
revoke all on function public.admin_mark_shipped(uuid) from public, anon;
revoke all on function public.admin_mark_delivered(uuid) from public, anon;
revoke all on function public.admin_dashboard_summary() from public, anon;
revoke all on function public.admin_stock_alerts(integer) from public, anon;
grant execute on function public.admin_mark_shipped(uuid) to authenticated;
grant execute on function public.admin_mark_delivered(uuid) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_stock_alerts(integer) to authenticated;
