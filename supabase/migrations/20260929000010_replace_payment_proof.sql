-- Reemplazo de comprobantes: "un solo comprobante ACTIVO por pedido", con historial.
--
-- Estados del comprobante (payment_proofs.estado):
--   en_revision  activo, esperando al dueño
--   aprobado     activo, definitivo (no se puede cambiar)
--   rechazado    historial (con motivo)
--   reemplazado  historial (el cliente subió otro antes de que el dueño lo revisara)
-- Activos = en_revision y aprobado. Un pedido tiene como máximo UNO, y como máximo 3 comprobantes
-- en total (activos + historial).

-- ---------------------------------------------------------------------------
-- 1) Nuevo valor del enum
-- ---------------------------------------------------------------------------
-- Nota: un valor de enum recién agregado no puede USARSE en la misma transacción. Por eso el
-- índice de abajo solo nombra valores que ya existían, y 'reemplazado' aparece únicamente dentro
-- de cuerpos de funciones (que se evalúan al ejecutarse, no al crearlas).
alter type public.proof_status add value if not exists 'reemplazado';

-- ---------------------------------------------------------------------------
-- 2) Solo un comprobante activo por pedido
-- ---------------------------------------------------------------------------
create unique index payment_proofs_one_active
  on public.payment_proofs (order_id)
  where estado in ('en_revision', 'aprobado');

-- ---------------------------------------------------------------------------
-- 3) Transiciones válidas del comprobante
-- ---------------------------------------------------------------------------
-- Solo un comprobante 'en_revision' puede cambiar de estado; aprobado, rechazado y reemplazado son
-- finales. Así una aprobación "vieja" (de un comprobante que el cliente ya reemplazó) no se aplica:
-- el dueño no puede aprobar un archivo que ya no es el vigente. Además, 'reemplazado' solo lo puede
-- poner `submit_payment_proof` (que marca la transacción con app.replacing_proof).
create function public.payment_proofs_check_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if old.estado <> 'en_revision' then
    raise exception 'transicion_invalida' using errcode = 'P0001', detail = old.estado::text || ' -> ' || new.estado::text;
  end if;

  if new.estado::text = 'reemplazado'
     and coalesce(current_setting('app.replacing_proof', true), '') <> 'on' then
    raise exception 'transicion_invalida' using errcode = 'P0001', detail = 'reemplazado solo por submit_payment_proof';
  end if;

  return new;
end;
$$;

create trigger payment_proofs_transition
  before update of estado on public.payment_proofs
  for each row execute function public.payment_proofs_check_transition();

-- ---------------------------------------------------------------------------
-- 4) submit_payment_proof: subir, reemplazar o volver a subir tras un rechazo
-- ---------------------------------------------------------------------------
-- Solo el servidor (service_role), después de validar la sesión y el tipo real del archivo, y de
-- subirlo al bucket privado. TODO en una transacción y con el pedido bloqueado (`for update`):
-- la aprobación del dueño también bloquea el pedido primero, así que una aprobación y un reemplazo
-- simultáneos se ordenan y el segundo ve el estado que dejó el primero (nunca se pisan).
--
--   pendiente_pago       primera subida, o nueva subida tras un rechazo (el pedido volvió a este estado)
--   comprobante_recibido reemplazo: el comprobante activo debe seguir 'en_revision'
--   otro estado          se rechaza (pagado, enviado, cancelado, vencido...)
--
-- El plazo `vence_en` NO se reinicia: un pedido vencido no admite ni subida ni reemplazo.
-- Devuelve la ruta del archivo reemplazado (para borrarlo del bucket) y si el mismo archivo (hash)
-- ya está en OTRO pedido con un comprobante vigente (aviso para el dueño; el comprador no lo ve).
drop function if exists public.submit_payment_proof(uuid, uuid, text, text);

create function public.submit_payment_proof(
  p_user_id uuid,
  p_order_id uuid,
  p_archivo text,
  p_hash text
)
returns table (o_proof_id uuid, o_duplicado boolean, o_archivo_anterior text, o_reemplazo boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_active record;
  v_total integer;
  v_proof_id uuid;
  v_duplicado boolean;
  v_anterior text := null;
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
  if v_order.estado not in ('pendiente_pago', 'comprobante_recibido') then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;
  if v_order.vence_en <= now() then
    raise exception 'pedido_vencido' using errcode = 'P0001';
  end if;

  select count(*) into v_total from public.payment_proofs pp where pp.order_id = p_order_id;
  if v_total >= 3 then
    raise exception 'limite_comprobantes' using errcode = 'P0001';
  end if;

  if v_order.estado = 'comprobante_recibido' then
    -- Reemplazo: se bloquea el comprobante activo y debe seguir en revisión.
    select pp.id, pp.archivo, pp.hash, pp.estado into v_active
    from public.payment_proofs pp
    where pp.order_id = p_order_id and pp.estado in ('en_revision', 'aprobado')
    order by pp.created_at desc
    limit 1
    for update;

    if not found then
      raise exception 'estado_invalido' using errcode = 'P0001';
    end if;
    if v_active.estado = 'aprobado' then
      raise exception 'comprobante_aprobado' using errcode = 'P0001';
    end if;
    if v_active.hash = p_hash then
      raise exception 'mismo_archivo' using errcode = 'P0001';
    end if;

    perform set_config('app.replacing_proof', 'on', true);
    update public.payment_proofs set estado = 'reemplazado' where id = v_active.id;
    perform set_config('app.replacing_proof', 'off', true);
    v_anterior := v_active.archivo;
  elsif exists (
    select 1 from public.payment_proofs pp
    where pp.order_id = p_order_id and pp.estado in ('en_revision', 'aprobado')
  ) then
    -- Pendiente de pago pero con un comprobante vigente: estado incoherente, no se toca.
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  v_duplicado := exists (
    select 1 from public.payment_proofs pp
    where pp.hash = p_hash and pp.order_id <> p_order_id and pp.estado::text <> 'reemplazado'
  );

  insert into public.payment_proofs (order_id, archivo, hash)
  values (p_order_id, p_archivo, p_hash)
  returning id into v_proof_id;

  if v_order.estado = 'pendiente_pago' then
    update public.orders set estado = 'comprobante_recibido' where id = p_order_id;
  end if;

  return query select v_proof_id, v_duplicado, v_anterior, v_anterior is not null;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_payment_proof(uuid, uuid, text, text) to service_role;
