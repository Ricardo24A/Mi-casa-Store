-- Constancia de aceptación de los Términos y Condiciones y la Política de Privacidad.
--
--   · En el REGISTRO: `profiles.terminos_aceptados_en` y `profiles.terminos_version`. El servidor valida la
--     casilla (Zod) y manda la versión como metadato del registro; el trigger `handle_new_user` la guarda.
--   · En el CHECKOUT: `orders.terminos_aceptados_en` y `orders.terminos_version`, con `record_order_terms`
--     (solo service_role), que la guarda justo después de `create_order`. Se hizo una función aparte en vez de
--     cambiar `create_order` (pedido atómico con reserva de stock) para no tocar una función delicada; si
--     esa llamada fallara, el pedido sigue (la casilla ya se validó en el servidor) y queda una línea en el
--     registro del servidor. También completa el perfil si aún no tenía constancia.
--
-- Las columnas nuevas NO son editables por la API: los permisos de columna de `profiles` y `orders` solo
-- permiten editar las que ya figuraban (nombre y teléfono; estado y notas del admin). Los metadatos del
-- registro los puede escribir quien llame a Supabase Auth directamente, así que la constancia del registro
-- solo prueba lo que ese usuario declaró al crear su cuenta; la del pedido la escribe únicamente el servidor.

-- Versión: solo caracteres inocuos y corta (la arma el servidor, p. ej. "terminos 2026-10-02 + privacidad 2026-10-02").
alter table public.profiles
  add column terminos_aceptados_en timestamptz,
  add column terminos_version text,
  add constraint profiles_terminos_validos check (
    (terminos_aceptados_en is null) = (terminos_version is null)
    and (terminos_version is null or terminos_version ~ '^[A-Za-z0-9 ._:/+-]{1,80}$')
  );

alter table public.orders
  add column terminos_aceptados_en timestamptz,
  add column terminos_version text,
  add constraint orders_terminos_validos check (
    (terminos_aceptados_en is null) = (terminos_version is null)
    and (terminos_version is null or terminos_version ~ '^[A-Za-z0-9 ._:/+-]{1,80}$')
  );

-- ---------------------------------------------------------------------------
-- Registro: el trigger guarda la versión que mandó el servidor (si es válida)
-- ---------------------------------------------------------------------------
-- Misma función de la migración 6 (el rol sigue siendo siempre 'customer'; solo se copian el nombre y,
-- ahora, la versión de los términos, recortada y validada).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'terminos_version', '')), 80), '');
begin
  if v_version is not null and v_version !~ '^[A-Za-z0-9 ._:/+-]{1,80}$' then
    v_version := null;
  end if;

  insert into public.profiles (id, role, full_name, terminos_aceptados_en, terminos_version)
  values (
    new.id,
    'customer',
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    case when v_version is null then null else now() end,
    v_version
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout: constancia en el pedido (y en el perfil, si faltaba)
-- ---------------------------------------------------------------------------
create function public.record_order_terms(p_order_id uuid, p_user_id uuid, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_version is null or p_version !~ '^[A-Za-z0-9 ._:/+-]{1,80}$' then
    raise exception 'version_invalida' using errcode = 'P0001';
  end if;

  -- Solo el pedido de ese usuario y solo una vez: una constancia ya guardada no se pisa.
  update public.orders
     set terminos_aceptados_en = now(), terminos_version = p_version
   where id = p_order_id and user_id = p_user_id and terminos_aceptados_en is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'pedido_no_encontrado' using errcode = 'P0001';
  end if;

  update public.profiles
     set terminos_aceptados_en = now(), terminos_version = p_version
   where id = p_user_id and terminos_aceptados_en is null;
end;
$$;

revoke all on function public.record_order_terms(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.record_order_terms(uuid, uuid, text) to service_role;
