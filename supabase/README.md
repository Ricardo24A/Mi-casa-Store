# Supabase

- `migrations/` — esquema, RLS/permisos y buckets. Se aplican en orden por nombre.
- `seed.sql` — categorías y plantillas de productos (desde el prototipo). Idempotente.
- `tests/rls.test.sql` — pruebas de RLS y restricciones (transacción con rollback). Solo en desarrollo/staging.

Nada de esto se ejecuta solo: aplícalo tú (SQL Editor de Supabase o `supabase db push`).

## Configuración del proyecto Supabase

- "Automatically expose new tables" desactivado: los permisos (GRANT) están en `20260929000002_rls_grants.sql`.
- Si se añade una tabla nueva, hay que darle `enable row level security`, sus GRANT y sus políticas.
- La clave `service_role` va solo en variables de entorno del servidor (`SUPABASE_SERVICE_ROLE_KEY`). Nunca en el navegador ni en el repositorio.

## Crear el primer administrador

Todo usuario nuevo es `customer`. El rol admin no se puede asignar desde la API. Tras crear la cuenta del dueño (Authentication → Users), ejecutar una vez en el SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'correo-del-dueno@ejemplo.com');
```
