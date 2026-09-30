-- Teléfonos del negocio: principal y secundario, normalizados y validados para Ecuador.
--
-- Se guardan solo dígitos, en formato nacional (sin +593, espacios, guiones ni paréntesis):
--   · celular: 10 dígitos, 09 + 8 dígitos (el tercero de 1 a 9)
--   · fijo: 9 dígitos, código de provincia 02 a 07 + 7 dígitos
-- La aplicación (Zod) normaliza lo que escribe el dueño y aplica la misma regla; esto impide que un
-- dato mal formado entre aunque alguien escriba directo a la base. Solo aplica al teléfono del
-- negocio: el teléfono del comprador (customer_addresses, orders) mantiene su regla propia.

-- ---------------------------------------------------------------------------
-- 1) Regla de un número
-- ---------------------------------------------------------------------------
create function public.valid_ec_phone(p text)
returns boolean
language sql
immutable
as $$
  select
    p ~ '^(09[1-9][0-9]{7}|0[2-7][0-9]{7})$'
    -- Sin todos los dígitos iguales (0999999999), ni tras el 09 o el código de provincia (0911111111)
    and translate(substr(p, 2), substr(p, 2, 1), '') <> ''
    and translate(substr(p, 3), substr(p, 3, 1), '') <> ''
    -- Sin secuencias obvias: el número entero (0123456789, 0987654321) o, en un celular, sus 8 últimos
    -- dígitos (12345678). Una secuencia de 7 dígitos en un fijo (234 5678) es un número posible.
    and position(p in '01234567890123456789') = 0
    and position(p in '98765432109876543210') = 0
    and (length(p) = 9
         or (position(substr(p, 3) in '01234567890123456789') = 0
             and position(substr(p, 3) in '98765432109876543210') = 0));
$$;

-- ---------------------------------------------------------------------------
-- 2) Segundo teléfono y restricciones
-- ---------------------------------------------------------------------------
alter table public.store_settings add column telefono_secundario text;

-- Lo que ya hubiera en `telefono` con otro formato no cumple la regla nueva: se vacía para que el
-- dueño lo escriba de nuevo (la pantalla lo normaliza). No se intenta adivinar el número.
update public.store_settings set telefono = null where telefono is not null and not public.valid_ec_phone(telefono);

alter table public.store_settings
  add constraint store_settings_telefono_valido
    check (telefono is null or public.valid_ec_phone(telefono)),
  add constraint store_settings_telefono_secundario_valido
    check (telefono_secundario is null or public.valid_ec_phone(telefono_secundario)),
  -- El secundario no va solo y no repite al principal (ya normalizados, se comparan tal cual)
  add constraint store_settings_telefonos_distintos
    check (telefono_secundario is null or (telefono is not null and telefono_secundario <> telefono));

-- ---------------------------------------------------------------------------
-- 3) Permisos y vista pública
-- ---------------------------------------------------------------------------
grant update (telefono_secundario) on public.store_settings to authenticated;

-- El pie de la tienda muestra los dos números. La columna nueva va al final de la vista.
create or replace view public.store_public_info as
select
  s.nombre_negocio,
  s.email_contacto,
  s.telefono,
  s.direccion,
  s.enlaces_redes,
  s.telefono_secundario
from public.store_settings s;
