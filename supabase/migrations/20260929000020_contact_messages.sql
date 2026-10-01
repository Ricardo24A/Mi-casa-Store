-- Mensajes de contacto de la tienda y horario de atención del negocio.
--
-- 1) `contact_messages`: lo que escribe un visitante en /contacto. Nadie lee ni escribe la tabla
--    directo por la API salvo el administrador con 2FA, que solo la LEE. Los mensajes se crean
--    únicamente con `create_contact_message` (la llama el servidor con service_role, después de
--    validar con Zod y Turnstile) y cambian de estado con una función por transición, con el
--    mismo patrón que los pedidos: is_admin(), bloqueo de la fila y verificación del estado anterior.
--
--      marcar leído   nuevo          -> leido
--      archivar       nuevo o leido  -> archivado
--
-- 2) `store_settings.horario_atencion`: texto corto opcional que la tienda muestra en /contacto
--    (vista pública `store_public_info`).

-- ---------------------------------------------------------------------------
-- 1) Formato de los datos de contacto (la misma regla que Zod en src/lib/validation/contact.ts)
-- ---------------------------------------------------------------------------
-- Correo: parte local de hasta 64 caracteres y dominio con extensión de letras. Postgres limita las
-- repeticiones de un regex a 255, así que el largo total se acota aparte (254).
create function public.valid_contact_email(p text)
returns boolean
language sql
immutable
as $$
  select char_length(p) between 6 and 254
     and p ~ '^[A-Za-z0-9._''+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}$'
     and p !~ '\.\.';
$$;

-- Texto de una sola línea (nombre, asunto, horario): sin espacios sobrantes, sin caracteres de
-- control y sin nada con forma de etiqueta HTML (`<` seguido de letra, `/` o `!`). "a < b" o "<3"
-- siguen siendo válidos.
create function public.valid_plain_line(p text, p_min integer, p_max integer)
returns boolean
language sql
immutable
as $$
  select char_length(p) between p_min and p_max
     and p = btrim(p)
     and p !~ '[[:cntrl:]]'
     and p !~ '</?[A-Za-z!]';
$$;

-- Texto de varias líneas (mensaje): como el anterior, pero admite saltos de línea (\n) y tabuladores.
-- Se guarda y se muestra como texto, nunca como HTML.
create function public.valid_plain_text(p text, p_min integer, p_max integer)
returns boolean
language sql
immutable
as $$
  select char_length(p) between p_min and p_max
     and p = btrim(p, E' \n\t')
     and translate(p, E'\n\t', '') !~ '[[:cntrl:]]'
     and p !~ '</?[A-Za-z!]';
$$;

-- ---------------------------------------------------------------------------
-- 2) Tabla
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (public.valid_plain_line(nombre, 2, 120)),
  email text not null check (public.valid_contact_email(email)),
  -- Normalizado: solo dígitos, formato nacional (misma regla que los teléfonos del negocio).
  telefono text not null check (public.valid_ec_phone(telefono)),
  asunto text check (asunto is null or public.valid_plain_line(asunto, 1, 120)),
  mensaje text not null check (public.valid_plain_text(mensaje, 10, 1000)),
  -- Cuándo aceptó el tratamiento de datos (la casilla es obligatoria).
  aceptado_en timestamptz not null,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'leido', 'archivado')),
  created_at timestamptz not null default now(),
  leido_en timestamptz,
  -- Huella del IP (HMAC calculado en el servidor; nunca el IP en claro), solo para el límite de
  -- envíos. Se borra pasado un día (ver create_contact_message).
  ip_hash text check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  constraint contact_messages_leido_coherente check (estado = 'nuevo' or leido_en is not null)
);

create index contact_messages_estado_idx on public.contact_messages (estado, created_at desc);
create index contact_messages_email_idx on public.contact_messages (lower(email), created_at desc);
create index contact_messages_ip_idx on public.contact_messages (ip_hash, created_at desc) where ip_hash is not null;

alter table public.contact_messages enable row level security;

-- Permisos explícitos: solo LECTURA para authenticated, y la política deja pasar solo al admin con 2FA.
-- Ni anon ni service_role tocan la tabla: el servidor crea mensajes con la función de abajo.
revoke all on public.contact_messages from public, anon, authenticated, service_role;
grant select on public.contact_messages to authenticated;

create policy contact_messages_admin_select on public.contact_messages
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3) Crear un mensaje (solo el servidor)
-- ---------------------------------------------------------------------------
-- Valida todo de nuevo (largos, formato del correo y del teléfono, la aceptación) y aplica el
-- límite de envíos: como máximo 3 por correo y 10 por IP en una hora. Un IP admite más porque en
-- Ecuador muchos celulares salen a internet con un IP compartido. Los dos conteos se hacen con un
-- bloqueo por correo y por IP, así dos envíos simultáneos no se saltan el límite.
create function public.create_contact_message(
  p_nombre text,
  p_email text,
  p_telefono text,
  p_asunto text,
  p_mensaje text,
  p_acepta boolean,
  p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_asunto text := nullif(p_asunto, '');
begin
  if p_nombre is null or not public.valid_plain_line(p_nombre, 2, 120) then
    raise exception 'nombre_invalido' using errcode = 'P0001';
  end if;
  if p_email is null or not public.valid_contact_email(p_email) then
    raise exception 'email_invalido' using errcode = 'P0001';
  end if;
  if p_telefono is null or not public.valid_ec_phone(p_telefono) then
    raise exception 'telefono_invalido' using errcode = 'P0001';
  end if;
  if v_asunto is not null and not public.valid_plain_line(v_asunto, 1, 120) then
    raise exception 'asunto_invalido' using errcode = 'P0001';
  end if;
  if p_mensaje is null or not public.valid_plain_text(p_mensaje, 10, 1000) then
    raise exception 'mensaje_invalido' using errcode = 'P0001';
  end if;
  if p_acepta is distinct from true then
    raise exception 'aceptacion_requerida' using errcode = 'P0001';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'ip_invalido' using errcode = 'P0001';
  end if;

  -- Límite por correo (sin distinguir mayúsculas)
  perform pg_advisory_xact_lock(hashtextextended('contacto:email:' || lower(p_email), 0));
  if (select count(*) from public.contact_messages m
      where lower(m.email) = lower(p_email) and m.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'limite_mensajes' using errcode = 'P0001';
  end if;

  -- Límite por IP
  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('contacto:ip:' || p_ip_hash, 0));
    if (select count(*) from public.contact_messages m
        where m.ip_hash = p_ip_hash and m.created_at > now() - interval '1 hour') >= 10 then
      raise exception 'limite_mensajes' using errcode = 'P0001';
    end if;
  end if;

  insert into public.contact_messages (nombre, email, telefono, asunto, mensaje, aceptado_en, ip_hash)
  values (p_nombre, p_email, p_telefono, v_asunto, p_mensaje, now(), p_ip_hash)
  returning id into v_id;

  -- La huella del IP solo sirve para el límite de la última hora: no se guarda más de un día.
  update public.contact_messages
     set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '1 day';

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Cambios de estado (solo el administrador con 2FA)
-- ---------------------------------------------------------------------------
create function public.admin_mark_message_read(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;

  select m.estado into v_estado from public.contact_messages m where m.id = p_id for update;
  if not found then
    raise exception 'mensaje_no_encontrado' using errcode = 'P0001';
  end if;
  if v_estado <> 'nuevo' then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  update public.contact_messages set estado = 'leido', leido_en = now() where id = p_id;
  return 'leido';
end;
$$;

create function public.admin_archive_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;

  select m.estado into v_estado from public.contact_messages m where m.id = p_id for update;
  if not found then
    raise exception 'mensaje_no_encontrado' using errcode = 'P0001';
  end if;
  if v_estado not in ('nuevo', 'leido') then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;

  -- Archivar uno nuevo también lo da por leído.
  update public.contact_messages
     set estado = 'archivado', leido_en = coalesce(leido_en, now())
   where id = p_id;
  return 'archivado';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Permisos de las funciones
-- ---------------------------------------------------------------------------
revoke all on function public.valid_contact_email(text) from public, anon, authenticated, service_role;
revoke all on function public.valid_plain_line(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.valid_plain_text(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.create_contact_message(text, text, text, text, text, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_mark_message_read(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_archive_message(uuid) from public, anon, authenticated, service_role;

grant execute on function public.create_contact_message(text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.admin_mark_message_read(uuid) to authenticated;
grant execute on function public.admin_archive_message(uuid) to authenticated;
-- El admin edita el horario desde Configuración, y la restricción de la columna usa valid_plain_line.
grant execute on function public.valid_plain_line(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Horario de atención en Configuración y en la vista pública
-- ---------------------------------------------------------------------------
alter table public.store_settings
  add column horario_atencion text
    constraint store_settings_horario_valido check (horario_atencion is null or public.valid_plain_line(horario_atencion, 1, 120));

grant update (horario_atencion) on public.store_settings to authenticated;

-- La columna nueva va al final de la vista (create or replace no permite reordenar).
create or replace view public.store_public_info as
select
  s.nombre_negocio,
  s.email_contacto,
  s.telefono,
  s.direccion,
  s.enlaces_redes,
  s.telefono_secundario,
  s.horario_atencion
from public.store_settings s;
