-- Cambios de estado de un pedido desde el dashboard: aprobar, rechazar y cancelar.
--
-- CADA cambio de estado es UNA función con transacción que:
--   1. comprueba que quien llama es el administrador con 2FA (is_admin(): rol admin + aal2);
--   2. BLOQUEA el pedido (`for update`) antes de mirar nada;
--   3. verifica el estado ANTERIOR, así que repetir una llamada o cruzarse con otra (por ejemplo,
--      una aprobación y un reemplazo del comprobante a la vez) falla limpio, sin aprobar dos veces
--      ni liberar dos veces la reserva;
--   4. cambia pedido, comprobante y stock juntos.
--
--   aprobar            comprobante_recibido -> pagado     descuenta stock y consume la reserva
--   rechazar comprobante comprobante_recibido -> pendiente_pago  conserva la reserva, plazo NUEVO
--   rechazar pedido    comprobante_recibido -> rechazado  libera la reserva
--   cancelar           pendiente_pago | comprobante_recibido -> cancelado  libera la reserva
--   vencer             pendiente_pago -> vencido          libera la reserva (migración anterior)
--
-- Las funciones se llaman con la sesión del administrador (rol `authenticated`), así quedan
-- registrados quién revisó (auth.uid()). Bloqueo en orden: primero el pedido, luego el comprobante y
-- luego los productos; submit_payment_proof sigue el mismo orden.

-- ---------------------------------------------------------------------------
-- 0) Ya no se cambia el estado con un UPDATE directo desde la API
-- ---------------------------------------------------------------------------
-- Antes el administrador podía hacer UPDATE de orders.estado y de payment_proofs.estado por la API, lo
-- que se saltaría el stock y las verificaciones. Ahora solo las funciones de abajo pueden hacerlo.
revoke update (estado) on public.orders from authenticated;
revoke update on public.payment_proofs from authenticated;

-- ---------------------------------------------------------------------------
-- Validación del motivo (rechazos y cancelaciones)
-- ---------------------------------------------------------------------------
create function public.order_reason(p_motivo text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_motivo, ''));
begin
  if char_length(v) < 3 or char_length(v) > 500 then
    raise exception 'motivo_invalido' using errcode = 'P0001';
  end if;
  return v;
end;
$$;
revoke all on function public.order_reason(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aprobar el pago
-- ---------------------------------------------------------------------------
-- Descuenta el stock y consume la reserva. `p_proof_id` debe ser el comprobante VIGENTE que el dueño
-- está viendo: si el cliente lo reemplazó mientras tanto, falla con comprobante_no_vigente.
create function public.admin_approve_order(p_order_id uuid, p_proof_id uuid)
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

  update public.orders set estado = 'pagado' where id = p_order_id;
  return 'pagado';
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechazar el comprobante (el cliente puede subir otro)
-- ---------------------------------------------------------------------------
-- El pedido vuelve a pendiente_pago con un plazo NUEVO de horas_limite_pago contado desde el rechazo.
-- La reserva se conserva. Como un pedido admite como máximo 3 comprobantes, el tiempo máximo con stock
-- reservado por plazos queda acotado (ver CLAUDE.md, sección 8); el reemplazo de un comprobante en
-- revisión NO reinicia el plazo.
create function public.admin_reject_proof(p_order_id uuid, p_proof_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_proof record;
  v_motivo text;
  v_horas integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;
  v_motivo := public.order_reason(p_motivo);

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

  select s.horas_limite_pago into v_horas from public.store_settings s;

  update public.payment_proofs
     set estado = 'rechazado', motivo = v_motivo, revisado_por = (select auth.uid()), revisado_en = now()
   where id = p_proof_id;

  update public.orders
     set estado = 'pendiente_pago',
         vence_en = now() + make_interval(hours => v_horas)
   where id = p_order_id;
  return 'pendiente_pago';
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechazar el pedido definitivamente
-- ---------------------------------------------------------------------------
create function public.admin_reject_order(p_order_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_motivo text;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;
  v_motivo := public.order_reason(p_motivo);

  select o.id, o.estado into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;
  if v_order.estado <> 'comprobante_recibido' then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  -- El comprobante en revisión queda rechazado con el mismo motivo.
  update public.payment_proofs
     set estado = 'rechazado', motivo = v_motivo, revisado_por = (select auth.uid()), revisado_en = now()
   where order_id = p_order_id and estado = 'en_revision';

  perform public.order_release_reservation(p_order_id);

  update public.orders set estado = 'rechazado', motivo_estado = v_motivo where id = p_order_id;
  return 'rechazado';
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar el pedido (antes de pagar)
-- ---------------------------------------------------------------------------
create function public.admin_cancel_order(p_order_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_motivo text;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;
  v_motivo := public.order_reason(p_motivo);

  select o.id, o.estado into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;
  if v_order.estado not in ('pendiente_pago', 'comprobante_recibido') then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  -- Un comprobante que estaba en revisión se cierra para que no quede "por revisar".
  update public.payment_proofs
     set estado = 'rechazado', motivo = left('Pedido cancelado: ' || v_motivo, 500),
         revisado_por = (select auth.uid()), revisado_en = now()
   where order_id = p_order_id and estado = 'en_revision';

  perform public.order_release_reservation(p_order_id);

  update public.orders set estado = 'cancelado', motivo_estado = v_motivo where id = p_order_id;
  return 'cancelado';
end;
$$;

-- Solo sesiones autenticadas las ejecutan, y cada una comprueba is_admin() (rol admin + aal2).
revoke all on function public.admin_approve_order(uuid, uuid) from public, anon;
revoke all on function public.admin_reject_proof(uuid, uuid, text) from public, anon;
revoke all on function public.admin_reject_order(uuid, text) from public, anon;
revoke all on function public.admin_cancel_order(uuid, text) from public, anon;
grant execute on function public.admin_approve_order(uuid, uuid) to authenticated;
grant execute on function public.admin_reject_proof(uuid, uuid, text) to authenticated;
grant execute on function public.admin_reject_order(uuid, text) to authenticated;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated;
