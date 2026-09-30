-- Configuración de la tienda: límites razonables, datos bancarios y redes validados, y una vista
-- pública con SOLO lo que el cliente debe ver.
--
-- store_settings sigue siendo una sola fila que lee y edita únicamente el administrador con 2FA. Antes
-- de esta migración cualquier usuario autenticado tenía permiso de tabla (la política RLS lo frenaba);
-- ahora los permisos de tabla también son mínimos. Lo que necesita la tienda (nombre, contacto y redes
-- del pie de página) sale de la vista `store_public_info`. Las cuentas bancarias, el costo de envío, el
-- descuento por transferencia y el plazo de pago solo los lee el servidor (service_role) al crear un
-- pedido y al mostrar el pago a quien hizo el pedido.

-- ---------------------------------------------------------------------------
-- 1) El costo de envío puede estar sin definir
-- ---------------------------------------------------------------------------
-- Antes nacía en 0, lo que la tienda mostraba como "envío gratis" sin que el cliente lo hubiera decidido.
-- null = sin definir: el checkout muestra "A coordinar" y no lo suma al total.
alter table public.store_settings alter column costo_envio drop not null;
alter table public.store_settings alter column costo_envio drop default;
update public.store_settings set costo_envio = null where costo_envio = 0;

-- ---------------------------------------------------------------------------
-- 2) Límites razonables
-- ---------------------------------------------------------------------------
-- Se reemplazan las restricciones anteriores de estas dos columnas:
--   · plazo de pago: de 1 a 168 horas (7 días). Con 3 rechazos de comprobante el stock puede quedar
--     reservado hasta 4 plazos, así que un plazo largo reserva mercadería demasiado tiempo.
--   · descuento por transferencia: de 0 a menos de 100 (un 100% dejaría todo gratis).
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.store_settings'::regclass and con.contype = 'c'
      and (pg_get_constraintdef(con.oid) ilike '%horas_limite_pago%'
           or pg_get_constraintdef(con.oid) ilike '%descuento_transferencia_pct%')
  loop
    execute format('alter table public.store_settings drop constraint %I', c.conname);
  end loop;
end $$;

-- Si ya había un valor fuera de los nuevos límites, se acerca al límite en vez de fallar.
update public.store_settings set horas_limite_pago = 168 where horas_limite_pago > 168;
update public.store_settings set descuento_transferencia_pct = 99.99 where descuento_transferencia_pct >= 100;

alter table public.store_settings
  add constraint store_settings_horas_limite_pago_check check (horas_limite_pago between 1 and 168),
  add constraint store_settings_descuento_transferencia_check check (descuento_transferencia_pct >= 0 and descuento_transferencia_pct < 100);

-- ---------------------------------------------------------------------------
-- 3) Cuentas bancarias y redes: formato validado también en la base de datos
-- ---------------------------------------------------------------------------
-- La aplicación ya valida con Zod; estas funciones hacen que un dato mal formado no entre nunca,
-- aunque alguien escriba directo a la base.
create function public.valid_bank_accounts(p jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 10 then
      not exists (
        select 1
        from jsonb_array_elements(p) a
        where
          -- CASE: el orden de evaluación de OR no está garantizado, y mirar las claves de algo que no es
          -- un objeto daría un error en vez de "inválido".
          case
            when jsonb_typeof(a) <> 'object' then true
            -- Claves como conjunto (sin depender del orden de clasificación): exactamente 5 y las 5 esperadas.
            when (select count(*) from jsonb_object_keys(a)) <> 5
              or (select count(*) from jsonb_object_keys(a) k
                  where k in ('banco', 'identificacion', 'numero', 'tipo', 'titular')) <> 5 then true
            when jsonb_typeof(a -> 'banco') is distinct from 'string'
              or jsonb_typeof(a -> 'tipo') is distinct from 'string'
              or jsonb_typeof(a -> 'numero') is distinct from 'string'
              or jsonb_typeof(a -> 'titular') is distinct from 'string'
              or jsonb_typeof(a -> 'identificacion') is distinct from 'string' then true
            else
              char_length(a ->> 'banco') not between 1 and 80
              or (a ->> 'tipo') not in ('ahorros', 'corriente')
              or (a ->> 'numero') !~ '^[0-9]{5,25}$'
              or char_length(a ->> 'titular') not between 1 and 120
              or char_length(a ->> 'identificacion') not between 5 and 20
          end
      )
    else false
  end;
$$;

-- Redes: un objeto { red: "https://..." } con nombres en minúsculas y enlaces https sin espacios.
-- (Postgres limita las repeticiones de un regex a 255: después de https:// caben como máximo 255 caracteres.)
create function public.valid_social_links(p jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(p) = 'object' then
      not exists (
        select 1
        from jsonb_each(p) e
        where e.key !~ '^[a-z]{2,20}$'
           or jsonb_typeof(e.value) is distinct from 'string'
           or (e.value #>> '{}') !~ '^https://[^[:space:]]{4,255}$'
      )
    else false
  end;
$$;

alter table public.store_settings
  add constraint store_settings_cuentas_validas check (public.valid_bank_accounts(cuentas_bancarias)),
  add constraint store_settings_redes_validas check (public.valid_social_links(enlaces_redes));

-- ---------------------------------------------------------------------------
-- 4) Permisos explícitos de la tabla: solo el administrador (RLS) y solo las columnas editables
-- ---------------------------------------------------------------------------
revoke all on public.store_settings from anon, authenticated;
grant select on public.store_settings to authenticated; -- la política store_settings_admin_select deja pasar solo al admin con 2FA
grant update (
  nombre_negocio, email_contacto, telefono, direccion, cuentas_bancarias, costo_envio,
  envio_gratis_desde, descuento_transferencia_pct, horas_limite_pago, umbral_stock_bajo, enlaces_redes
) on public.store_settings to authenticated;
-- Sin INSERT ni DELETE para nadie por la API: es una sola fila que no se crea ni se borra.

-- ---------------------------------------------------------------------------
-- 5) Lo que la tienda puede leer sin iniciar sesión: solo nombre, contacto y redes
-- ---------------------------------------------------------------------------
-- Es una vista con los permisos de su dueño (no security_invoker) a propósito: así la tienda lee estas
-- columnas sin abrir la tabla entera. NO incluye cuentas bancarias, envío, descuentos ni plazos.
create view public.store_public_info as
select
  s.nombre_negocio,
  s.email_contacto,
  s.telefono,
  s.direccion,
  s.enlaces_redes
from public.store_settings s;

revoke all on public.store_public_info from anon, authenticated;
grant select on public.store_public_info to anon, authenticated, service_role;
