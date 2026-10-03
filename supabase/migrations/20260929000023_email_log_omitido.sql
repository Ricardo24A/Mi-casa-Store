-- email_log: estado "omitido".
--
-- Un correo que no se puede enviar porque no hay a quién (por ejemplo, el aviso al dueño sin EMAIL_OWNER_TO ni
-- correo de contacto en Configuración) ya no se pierde en silencio: deja una fila con estado "omitido" y el
-- motivo en `error`. Sigue sin guardarse ninguna dirección: la huella es la de un destinatario vacío o inválido.
--
-- Solo cambia la restricción de estados y la función que marca resultados; los permisos de la función se
-- conservan (create or replace).

alter table public.email_log drop constraint if exists email_log_estado_check;
alter table public.email_log
  add constraint email_log_estado_check check (estado in ('pendiente', 'enviado', 'fallido', 'simulado', 'omitido'));

create or replace function public.email_log_finish(p_id uuid, p_estado text, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_estado not in ('enviado', 'fallido', 'simulado', 'omitido') then
    raise exception 'estado_invalido' using errcode = 'P0001';
  end if;
  update public.email_log
     set estado = p_estado, error = left(p_error, 300)
   where id = p_id and estado = 'pendiente';
end;
$$;

-- Por si el entorno no conservó los permisos al reemplazar la función: mismos que en la migración 22.
revoke all on function public.email_log_finish(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.email_log_finish(uuid, text, text) to service_role;
