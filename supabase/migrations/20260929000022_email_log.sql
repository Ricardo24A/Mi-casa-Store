-- Registro de correos transaccionales: evita enviar dos veces el mismo evento y deja constancia de
-- si salió, falló o fue una simulación.
--
-- La tabla guarda solo una huella HMAC del destinatario (calculada en el servidor) y la dirección
-- enmascarada (a***@g***.com), nunca el correo ni el contenido. Solo el administrador con 2FA la lee. Nadie
-- la escribe por la API: el servidor (service_role) usa dos funciones,
--
--   email_log_claim   reclama un evento ANTES de enviar. Devuelve el id si lo reclamó y null si ya
--                     estaba reclamado (duplicado). Un reclamo "pendiente" de hace más de 10 minutos
--                     (el proceso murió antes de enviar) se puede volver a reclamar.
--   email_log_finish  marca el resultado: enviado, fallido o simulado.
--
-- La restricción única (tipo, referencia_id, destinatario_hash) es lo que impide el duplicado, incluso con
-- dos solicitudes simultáneas. Los eventos que pueden repetirse legítimamente (un comprobante rechazado, un
-- comprobante nuevo) usan como referencia el id del comprobante, no la del pedido.
-- pg_cron borra lo de más de 90 días.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  -- Tipo de correo: pedido_creado, comprobante_recibido, pago_aprobado... (sin lista cerrada: un tipo nuevo no pide migración)
  tipo text not null check (tipo ~ '^[a-z_]{1,40}$'),
  referencia_id text not null check (char_length(referencia_id) between 1 and 200),
  destinatario_hash text not null check (destinatario_hash ~ '^[a-f0-9]{64}$'),
  destinatario_mascara text not null check (char_length(destinatario_mascara) between 1 and 120),
  estado text not null check (estado in ('pendiente', 'enviado', 'fallido', 'simulado')),
  error text check (error is null or char_length(error) <= 300),
  creado_en timestamptz not null default now(),
  constraint email_log_unico unique (tipo, referencia_id, destinatario_hash)
);

create index email_log_creado_idx on public.email_log (creado_en);

alter table public.email_log enable row level security;

-- Permisos explícitos: solo LECTURA para authenticated, y la política deja pasar solo al admin con 2FA.
-- Ni anon ni service_role tocan la tabla directo.
revoke all on public.email_log from public, anon, authenticated, service_role;
grant select on public.email_log to authenticated;

create policy email_log_admin_select on public.email_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reclamar un evento (antes de enviar)
-- ---------------------------------------------------------------------------
create function public.email_log_claim(p_tipo text, p_referencia text, p_hash text, p_mascara text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.email_log (tipo, referencia_id, destinatario_hash, destinatario_mascara, estado)
  values (p_tipo, p_referencia, p_hash, p_mascara, 'pendiente')
  on conflict (tipo, referencia_id, destinatario_hash) do update
    set creado_en = now(), estado = 'pendiente', error = null
    -- Solo se recupera un reclamo abandonado; uno enviado, fallido o simulado no se repite.
    where public.email_log.estado = 'pendiente' and public.email_log.creado_en < now() - interval '10 minutes'
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Marcar el resultado
-- ---------------------------------------------------------------------------
create function public.email_log_finish(p_id uuid, p_estado text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_estado not in ('enviado', 'fallido', 'simulado') then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;
  update public.email_log
     set estado = p_estado, error = left(p_error, 300)
   where id = p_id and estado = 'pendiente';
end;
$$;

-- ---------------------------------------------------------------------------
-- Limpieza: nada de más de 90 días
-- ---------------------------------------------------------------------------
create function public.cleanup_email_log()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.email_log where creado_en < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.email_log_claim(text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.email_log_finish(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_email_log() from public, anon, authenticated, service_role;
grant execute on function public.email_log_claim(text, text, text, text) to service_role;
grant execute on function public.email_log_finish(uuid, text, text) to service_role;
-- cleanup_email_log: solo pg_cron (corre con los permisos del dueño de la base).

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cleanup-email-log', '23 3 * * *', 'select public.cleanup_email_log()');
  else
    raise notice 'pg_cron no está activo: activa la extensión y vuelve a ejecutar este bloque para limpiar email_log.';
  end if;
end $$;
