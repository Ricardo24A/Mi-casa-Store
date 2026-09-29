# Supabase

- `migrations/`: esquema, permisos y RLS, buckets y vistas. Se aplican en orden por nombre; las ya aplicadas no se editan.
- `seed.sql`: categorías y plantillas de productos (desde el prototipo). Idempotente.
- `tests/rls.test.sql`: pruebas de RLS, permisos y restricciones (transacción con rollback). Solo en desarrollo.

El orden de aplicación, las variables de entorno y cómo crear el primer administrador están en el [README de la raíz](../README.md).

Al añadir una tabla o vista nueva: `enable row level security` (tablas), `revoke all` y los `grant` mínimos (el proyecto no expone tablas automáticamente), sus políticas y sus pruebas en `tests/rls.test.sql`.
