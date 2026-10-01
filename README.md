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
| `RATE_LIMIT_SECRET` | Una cadena larga al azar (`openssl rand -hex 32`) | **Solo servidor.** Opcional: clave del HMAC del IP para el límite del formulario de contacto; sin ella se usa la clave `service_role` |

## Base de datos (Supabase)

Ajustes del proyecto: **desactivar** "Automatically expose new tables" y **activar** el RLS automático. Los permisos se conceden de forma explícita en las migraciones.

Aplica los archivos de [`supabase/`](supabase/) **en este orden** (SQL Editor de Supabase, o `supabase db push` con la CLI):

1. `migrations/20260929000001_schema.sql`: tablas, restricciones y triggers.
2. `migrations/20260929000002_rls_grants.sql`: permisos (GRANT) y políticas RLS.
3. `migrations/20260929000003_storage.sql`: buckets `product-images` (público) y `payment-proofs` (privado).
4. `migrations/20260929000004_visible_categories.sql`: vista de categorías con productos activos.
5. `migrations/20260929000005_admin_aal2.sql`: `is_admin()` exige 2FA (aal2); umbral de poco stock y enlaces de redes en `store_settings`.
6. `migrations/20260929000006_customer_accounts.sql`: nombre del registro en el perfil, direcciones de envío del cliente y documentación de `orders.user_id`.
7. `migrations/20260929000007_create_order.sql`: función `create_order` (pedido atómico con stock apartado, solo `service_role`).
8. `migrations/20260929000008_cart_items.sql`: carrito de la cuenta (`cart_items`, con RLS por dueño) y `create_order` actualizada para vaciarlo al crear el pedido.
9. `migrations/20260929000009_payment_proof_base.sql`: restricciones de stock verificadas, `create_order` valida cantidades, bucket de comprobantes a 4 MB y `submit_payment_proof`.
10. `migrations/20260929000010_replace_payment_proof.sql`: estado `reemplazado`, un solo comprobante activo por pedido (historial, máximo 3), transiciones válidas del comprobante y `submit_payment_proof` con reemplazo.
11. `migrations/20260929000011_order_expiry.sql`: `reserva_activa`, liberar y consumir la reserva, `expire_orders()` y el cron `expire-orders` (pg_cron, cada 5 minutos).
12. `migrations/20260929000012_order_transitions.sql`: `admin_approve_order`, `admin_reject_proof`, `admin_reject_order` y `admin_cancel_order` (una función por cambio de estado). Quita el UPDATE directo de `orders.estado` y de `payment_proofs`.
13. `migrations/20260929000013_categories_admin.sql`: `categories.activa`, `category_visible()`, la vista `visible_categories` y la política de `products` respetan las categorías desactivadas, dos niveles, nombres únicos por padre y `admin_move_category`.
14. `migrations/20260929000014_create_order_category_active.sql`: `create_order` rechaza productos de una categoría desactivada (aunque el servidor lea con `service_role`).
15. `migrations/20260929000015_product_images_limit.sql`: el bucket `product-images` admite hasta 4 MB.
16. `migrations/20260929000016_discounts_guards.sql`: porcentaje menor que 100, el destino de un descuento debe existir (producto o categoría) y se borra el descuento cuando se borra su destino.
17. `migrations/20260929000017_store_settings_admin.sql`: Configuración. Plazo de pago de 1 a 168 horas, descuento por transferencia de 0 a menos de 100, costo de envío opcional (`null` = "A coordinar"), cuentas bancarias y redes validadas en la base, permisos de `store_settings` solo para el admin con 2FA (columnas editables, sin insert ni delete) y la vista pública `store_public_info` con solo nombre, contacto y redes.
18. `migrations/20260929000018_store_phones.sql`: teléfono principal y secundario del negocio, normalizados (solo dígitos, formato nacional) y validados para Ecuador (celular 09 + 8 dígitos; fijo 02 a 07 + 7 dígitos; sin repetidos ni secuencias obvias; el secundario no repite al principal ni va solo), y la columna nueva en la vista pública `store_public_info`.
19. `migrations/20260929000019_order_fulfillment_dashboard.sql`: pedidos enviados y entregados (`admin_mark_shipped` y `admin_mark_delivered`, una función por transición), fechas `pagado_en`, `enviado_en` y `entregado_en`, y los datos del Resumen (`admin_dashboard_summary` y `admin_stock_alerts`, solo para el admin con 2FA).
20. `migrations/20260929000020_contact_messages.sql`: mensajes de /contacto (`contact_messages`, solo los lee el admin con 2FA; se crean solo con `create_contact_message`, que ejecuta `service_role`, valida todo y limita a 3 mensajes por correo y 10 por IP en una hora), `admin_mark_message_read` y `admin_archive_message`, y el horario de atención opcional en Configuración y en la vista pública `store_public_info`.
21. `migrations/20260929000021_order_limits_rate_limits.sql`: `create_order` acepta como máximo 3 pedidos en `pendiente_pago` por usuario, bloquea el carrito de la cuenta y exige que las líneas sean las del carrito (un doble envío no crea dos pedidos); tabla `rate_limits` y `rate_limit_hit()` (solo `service_role`, claves HMAC) para el límite de intentos, y el cron `cleanup-rate-limits` (pg_cron, cada hora).
17. `seed.sql`: categorías, subcategorías y plantillas de productos (idempotente).

Las migraciones ya aplicadas no se editan: los cambios van en migraciones nuevas.

### Crear el primer administrador

Todo usuario nuevo es `customer`; el rol admin no se puede asignar desde la API. Crea la cuenta del dueño en Supabase (Authentication → Users) y ejecuta una vez en el SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'correo-del-dueno@ejemplo.com');
```

### Vencimiento automático (cron)

La migración 11 programa `select public.expire_orders()` cada 5 minutos con **pg_cron**. Si la extensión no se puede activar desde la migración, actívala en Supabase → Database → Extensions → `pg_cron` y ejecuta otra vez el último bloque de esa migración. Para comprobar que corre: `select * from cron.job;` y `select * from cron.job_run_details order by start_time desc limit 5;`. La función es idempotente: repetirla no vence ni libera nada dos veces.

### 2FA del administrador

El dashboard exige un segundo factor (TOTP) en cada sesión. En el primer acceso el sistema pide enrolar una app de autenticación y sugiere registrar un segundo dispositivo. Desde la migración 5, `is_admin()` solo es verdadera con una sesión `aal2`: un administrador con solo la contraseña no puede leer ni escribir nada protegido, aunque llame a la API directamente.

**Emergencia: el dueño perdió el dispositivo del 2FA y no tiene un segundo factor.** Un factor solo se quita desde Supabase, con acceso de propietario del proyecto:

1. Comprueba la identidad del dueño por un canal fuera de la web (llamada o en persona).
2. Supabase → Authentication → Users → abre el usuario → sección **Factors** → elimina el factor TOTP. Si tu versión del panel no lo muestra, ejecuta en el SQL Editor:

   ```sql
   delete from auth.mfa_factors
   where user_id = (select id from auth.users where email = 'correo-del-dueno@ejemplo.com');
   ```

3. La siguiente vez que inicie sesión, el dashboard le pedirá enrolar un factor nuevo. Que registre dos dispositivos.
4. Si sospechas que la cuenta fue comprometida, cambia también su contraseña y cierra sus sesiones (Users → Sign out user).

### Cuentas de clientes (`/cuenta`)

Registro, login, confirmación de correo y recuperación de contraseña usan Supabase Auth. Configuración necesaria en Supabase → Authentication:

1. **URL Configuration:** `Site URL` = el dominio del sitio; en `Redirect URLs` agrega `https://TU-DOMINIO/**` (y `http://localhost:3000/**` en desarrollo).
2. **Email Templates** (recomendado: el enlace funciona aunque se abra en otro navegador). Reemplaza el enlace por:
   - *Confirm signup*: `{{ .SiteURL }}/cuenta/confirmar?token_hash={{ .TokenHash }}&type=email`
   - *Reset password*: `{{ .SiteURL }}/cuenta/confirmar?token_hash={{ .TokenHash }}&type=recovery`
3. **Sign In / Providers → Email:** deja activo "Confirm email".
4. **SMTP:** el correo integrado de Supabase tiene un límite muy bajo y es solo para pruebas. Antes de publicar configura SMTP propio con Resend (Authentication → SMTP Settings).

El rol nunca lo envía el cliente: el trigger `handle_new_user` crea todo perfil como `customer` e ignora `raw_user_meta_data`. Hay un solo login (`/login`) para clientes y administrador. Un cliente va a su destino o al home; un administrador va a `/admin`, donde se le pide registrar o verificar el 2FA: con solo la contraseña nunca obtiene el panel. `/admin/login` y `/cuenta/login` redirigen a `/login`.

**Turnstile:** crea un widget en Cloudflare y define `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` (ver `.env.example`). En producción, sin el secreto el servidor rechaza registros y logins de clientes.

### Pruebas de la base de datos

[`supabase/tests/rls.test.sql`](supabase/tests/rls.test.sql) prueba permisos, RLS (incluido el administrador con y sin 2FA), restricciones y la vista de categorías visibles. Corre dentro de una transacción con `ROLLBACK` y termina con `RLS OK`; si algo falla, lanza una excepción con el motivo. Ejecútalo en el SQL Editor **de un proyecto de desarrollo**, o en un Postgres local que simule los roles de Supabase.

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
