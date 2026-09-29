# Mi casa Store

Tienda online de productos para el hogar (Ecuador). Catálogo, carrito y pago por transferencia bancaria con comprobante; dashboard para el dueño. Las especificaciones y las fases de desarrollo están en [CLAUDE.md](CLAUDE.md).

**Stack:** Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Storage), Zod, Vercel.

## Requisitos

- Node.js 20 o superior y npm.
- Un proyecto de Supabase (de desarrollo, no el de producción, mientras se construye).

## Instalación

```bash
npm install
cp .env.example .env.local
```

Completa `.env.local` (no se sube al repositorio):

| Variable | Dónde se obtiene | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (`anon` o `publishable`) | Pública; la seguridad la dan las políticas RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (`service_role` o `secret`) | **Solo servidor.** Se salta RLS. Nunca con prefijo `NEXT_PUBLIC_`, ni en el navegador, ni en el repositorio |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en local; el dominio real en producción | |

## Base de datos (Supabase)

Ajustes del proyecto: **desactivar** "Automatically expose new tables" y **activar** el RLS automático. Los permisos se conceden de forma explícita en las migraciones.

Aplica los archivos de [`supabase/`](supabase/) **en este orden** (SQL Editor de Supabase, o `supabase db push` con la CLI):

1. `migrations/20260929000001_schema.sql`: tablas, restricciones y triggers.
2. `migrations/20260929000002_rls_grants.sql`: permisos (GRANT) y políticas RLS.
3. `migrations/20260929000003_storage.sql`: buckets `product-images` (público) y `payment-proofs` (privado).
4. `migrations/20260929000004_visible_categories.sql`: vista de categorías con productos activos.
5. `seed.sql`: categorías, subcategorías y plantillas de productos (idempotente).

Las migraciones ya aplicadas no se editan: los cambios van en migraciones nuevas.

### Crear el primer administrador

Todo usuario nuevo es `customer`; el rol admin no se puede asignar desde la API. Crea la cuenta del dueño en Supabase (Authentication → Users) y ejecuta una vez en el SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'correo-del-dueno@ejemplo.com');
```

### Pruebas de la base de datos

[`supabase/tests/rls.test.sql`](supabase/tests/rls.test.sql) prueba permisos, RLS, restricciones y la vista de categorías visibles. Corre dentro de una transacción con `ROLLBACK` y termina con `RLS OK`; si algo falla, lanza una excepción con el motivo. Ejecútalo en el SQL Editor **de un proyecto de desarrollo**, o en un Postgres local que simule los roles de Supabase.

## Comandos

```bash
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run build    # compilación de producción (incluye la revisión de tipos)
npm run start    # sirve la compilación de producción
npm run lint     # ESLint
npx tsc --noEmit # revisión de tipos
```

## Estructura

```
src/app/(tienda)/     vista del cliente
src/app/(admin)/      dashboard del dueño
src/lib/supabase/     clientes de Supabase (navegador, servidor, service_role)
src/lib/validation/   esquemas Zod
src/lib/auth.ts       getUser, getRole, requireAdmin
src/proxy.ts          refresco de sesión y protección de /admin
supabase/             migraciones, semilla y pruebas
prototipos/           solo referencia visual (fuera de TypeScript y ESLint)
```

## Seguridad

- `.env.local` nunca se sube. La clave `service_role` solo va en variables de entorno del servidor.
- Precios y totales se calculan siempre en el servidor; el navegador solo envía IDs y cantidades.
- Los comprobantes de pago viven en un bucket privado; el admin los ve con URLs firmadas temporales.
- Detalle y checklist completa en la sección 10 de [CLAUDE.md](CLAUDE.md).
