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
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en local; el dominio real en producción | **Obligatoria en producción** (también en Preview de Vercel): sin ella, o si no es `https://` con solo el dominio, `next build` y `next start` fallan con un mensaje claro. Solo `localhost` admite `http` |
| `RESEND_API_KEY` | resend.com → API Keys | **Solo servidor.** Opcional: sin ella los correos quedan en simulación (se registra el tipo y el destinatario enmascarado) |
| `EMAIL_FROM` | Tu remitente, p. ej. `Mi casa Store <pedidos@dominio>` | Vacío = remitente de prueba de Resend. Al verificar el dominio, solo se cambia esta variable |
| `EMAIL_OWNER_TO` | Correo del dueño | Opcional: vacío = el correo de contacto de Configuración |
| `EMAIL_TEST_TO` | Tu correo de Resend | **Solo pruebas**: redirige todos los correos a esta dirección. Vacía en producción |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → tu widget | Pública. En local sirve la clave de prueba de Cloudflare (ver `.env.example`) |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → tu widget | **Solo servidor.** En producción, sin ella el servidor rechaza registro, login, recuperación y contacto |
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
22. `migrations/20260929000022_email_log.sql`: registro de correos (`email_log`: tipo, referencia, huella HMAC y máscara del destinatario, estado) con restricción única para no enviar dos veces el mismo evento, funciones `email_log_claim` y `email_log_finish` (solo `service_role`), lectura solo para el admin con 2FA y limpieza a los 90 días (pg_cron `cleanup-email-log`).
23. `migrations/20260929000023_email_log_omitido.sql`: `email_log` admite el estado `omitido` (un correo sin destinatario válido deja una fila con el motivo, sin guardar ninguna dirección).
24. `migrations/20260929000024_terms_acceptance.sql`: constancia de aceptación de los Términos y la Política de Privacidad (`profiles` y `orders`: `terminos_aceptados_en`, `terminos_version`), el trigger `handle_new_user` guarda la versión del registro y `record_order_terms` (solo `service_role`) la guarda en el pedido.
25. `seed.sql` (después de todas las migraciones): categorías, subcategorías y plantillas de productos (idempotente).

Las migraciones ya aplicadas no se editan: los cambios van en migraciones nuevas.

### Crear el primer administrador

Todo usuario nuevo es `customer`; el rol admin no se puede asignar desde la API. Crea la cuenta del dueño en Supabase (Authentication → Users) y ejecuta una vez en el SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'correo-del-dueno@ejemplo.com');
```

### Vencimiento automático (cron)

La migración 11 programa `select public.expire_orders()` cada 5 minutos con **pg_cron**. Si la extensión no se puede activar desde la migración, actívala en Supabase → Database → Extensions → `pg_cron` y ejecuta otra vez el último bloque de esa migración. Para comprobar que corre: `select * from cron.job;` y `select * from cron.job_run_details order by start_time desc limit 5;`. La función es idempotente: repetirla no vence ni libera nada dos veces.

Otros tres trabajos de pg_cron se crean con sus migraciones y se pueden revisar con `select jobname, schedule, active from cron.job;`: `expire-orders` (migración 11, cada 5 minutos), `cleanup-rate-limits` (migración 21, cada hora) y `cleanup-email-log` (migración 22, a diario). Si `pg_cron` no estaba activo al aplicarlas, actívalo y vuelve a ejecutar el último bloque de cada migración.

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

**Contraseña nueva** (`/nueva-clave`, para clientes y administrador): desde el enlace de recuperación del correo no pide la contraseña actual (la ruta `/cuenta/confirmar` marca la sesión con un aviso firmado en una cookie httpOnly de 15 minutos); desde una sesión abierta sí la pide. Un administrador con 2FA que llega por el enlace confirma además con su código. Al guardar se cierran todas sus sesiones y vuelve al login (el administrador, con su 2FA). Hay enlaces en Mis datos y en Configuración.

El rol nunca lo envía el cliente: el trigger `handle_new_user` crea todo perfil como `customer` e ignora `raw_user_meta_data`. Hay un solo login (`/login`) para clientes y administrador. Un cliente va a su destino o al home; un administrador va a `/admin`, donde se le pide registrar o verificar el 2FA: con solo la contraseña nunca obtiene el panel. `/admin/login` y `/cuenta/login` redirigen a `/login`.

**Turnstile:** crea un widget en Cloudflare y define `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` (ver `.env.example`). En producción, sin el secreto el servidor rechaza registros y logins de clientes.

### Correos transaccionales (Resend)

Código en [`src/lib/email/`](src/lib/email/): plantillas (`templates.ts`, `render.ts`), lógica de envío (`send-core.ts`), conexión con Resend y la base (`mailer.ts`) y los puntos de entrada (`notify.ts`). Variables en la tabla de arriba y en `.env.example`.

| Correo | A quién | Cuándo | Se envía una vez por |
|---|---|---|---|
| Pedido creado (con cuentas y plazo) | Cliente | `crearPedido` | pedido |
| Comprobante recibido | Cliente | al subir o reemplazar el comprobante | comprobante |
| Pago aprobado | Cliente | `aprobarPedido` | pedido |
| Comprobante rechazado (con el motivo) | Cliente | `rechazarComprobante` | comprobante |
| Pedido enviado | Cliente | `marcarEnviado` | pedido |
| Pedido cancelado | Cliente | `cancelarPedido` | pedido |
| Pedido rechazado (con el motivo) | Cliente | `rechazarPedido` | pedido |
| Comprobante por revisar | Dueño | al subir o reemplazar el comprobante | comprobante |
| Nuevo mensaje de contacto (nombre, asunto, vista previa) | Dueño | al guardarse el mensaje | mensaje |

- Se envían **después** de guardar el cambio y con `after()`: nunca esperan al usuario ni pueden romper ni revertir el pedido, el comprobante, la aprobación o el mensaje. Si Resend falla, se registra `fallido` (un solo reintento corto ante 429, 5xx o red) y el flujo sigue.
- **Sin duplicados:** `email_log` reclama cada (tipo, referencia, destinatario) antes de enviar. Nada se guarda en claro: solo una huella HMAC y la dirección enmascarada.
- **Sin `RESEND_API_KEY`:** modo simulación (registra tipo y destinatario enmascarado en consola).
- Los enlaces usan `NEXT_PUBLIC_SITE_URL` y apuntan a `/confirmacion/[referencia]` (el pedido del cliente) y a `/admin/pedidos/[referencia]` o `/admin/mensajes` (el dueño).
- **Nada se omite en silencio:** al programarse cada evento escribe `[email:programado]` en el registro del servidor; un correo sin destinatario válido (p. ej. el aviso al dueño sin `EMAIL_OWNER_TO` ni correo de contacto en Configuración) deja `[email:omitido] … motivo=…` y una fila `omitido` en `email_log`.
- Los dos correos de un mismo evento (cliente y dueño) salen en orden con una pausa de 0,7 s (Resend limita las peticiones por segundo); un 429 se reintenta una sola vez y, si vuelve a fallar, queda `fallido` con el error.
- No hay correo al vencer un pedido (lo hace pg_cron, sin acción de la app detrás), ni al marcarlo entregado.
- Los correos de **Supabase Auth** (confirmar correo, recuperar contraseña) **no** pasan por aquí: siguen siendo de Supabase hasta configurar el SMTP propio con Resend.
- **Con el dominio verificado:** verifica el dominio en Resend (registros DNS), cambia `EMAIL_FROM` y deja `EMAIL_TEST_TO` vacía. No hay que tocar código.

### Documentos legales

El texto del cliente (`docs/legal/Documentos_Legales.pdf`) está publicado tal cual en [`src/content/legal/`](src/content/legal/) y se muestra en `/privacidad`, `/terminos` y `/cookies`. Cada documento tiene su fecha y su versión (`LEGAL_VERSIONS`). Para publicar un texto nuevo: edita el archivo del documento, cambia su `actualizado` y su `version`. La versión se guarda en el registro y en cada pedido (casilla obligatoria de Términos y Privacidad, validada en el servidor). En los Términos el plazo de pago no está escrito: se muestra el valor real de `horas_limite_pago` de Configuración.

### Pruebas de ataque (solo en desarrollo)

Una batería de ataques repetibles, sin herramientas externas, contra **desarrollo** (nunca producción: se niega a correr si `NEXT_PUBLIC_SITE_URL` no es local). **Todo ataque debe fallar**; cada intento queda impreso con lo esperado y lo real, y los desvíos que no son un ataque exitoso (p. ej. un código HTTP distinto del pedido) salen como `HALLAZ`, y lo que no se pudo probar como `BLOQ`.

**Qué hace falta**

1. Un build y dos servidores locales de producción (`next start`), porque login, registro y contacto exigen Turnstile:
   ```bash
   npm run build
   npm run start                                          # puerto 3100, "como producción sin clave de Turnstile"
   node supabase/tests/attack/serve-test-turnstile.mjs    # puerto 3101, con la clave de PRUEBA pública de Cloudflare
   ```
2. Variables en `.env.local` (sin llaves en el código): las de Supabase, `SUPABASE_SERVICE_ROLE_KEY` (solo para preparar datos `zz-sec-` y comprobar resultados), y tres cuentas de prueba **que tú creas** (las pruebas nunca crean cuentas):

   | Variable | Cuenta |
   |---|---|
   | `ATTACK_CUSTOMER_EMAIL` / `ATTACK_CUSTOMER_PASSWORD` | cliente 1 (rol `customer`) |
   | `ATTACK_CUSTOMER2_EMAIL` / `ATTACK_CUSTOMER2_PASSWORD` | cliente 2 (la "víctima" de los ataques del cliente 1) |
   | `ATTACK_ADMIN_NO2FA_EMAIL` / `ATTACK_ADMIN_NO2FA_PASSWORD` | administrador (`role = admin` puesto a mano) que **nunca** completa el 2FA: sesión `aal1` |

   Opcionales: `ATTACK_APP_URL` (por defecto `http://localhost:3101`), `ATTACK_APP_STRICT_URL` (`http://localhost:3100`), `ATTACK_REPORT_FILE` (guarda cada intento en JSON, una línea por intento). Sin una cuenta, las pruebas que la necesitan se saltan con el motivo.
3. Correr:
   ```bash
   npm run test:attack      # todo, un archivo a la vez
   npm test                 # incluye también las pruebas unitarias de ataque (correos y archivos)
   ```

**Qué cubre cada archivo de [`supabase/tests/attack/`](supabase/tests/attack/)**

| Archivo | Bloque |
|---|---|
| `rest-attacks.test.mjs` | API REST con anon y con un cliente: leer lo ajeno, escribir catálogo, pedidos y estados, funciones `admin_*` y de servidor, Storage |
| `authz-customers.test.mjs` | A. Cliente 1 contra cliente 2 (pedidos, comprobantes, direcciones, carrito, perfil, Storage), subirse el rol, tocar su propio pedido, dirección o carrito ajenos |
| `admin-no2fa.test.mjs` | B. Admin sin 2FA: RPC, tablas, Storage, rutas `/admin` y acciones del panel; cliente y visitante contra `/admin` |
| `business-logic.test.mjs` | C. Cantidades hostiles, totales recalculados, descuentos y cupones, productos inactivos, stock y concurrencia (20 pedidos simultáneos, 5 del mismo cliente, comprobantes a la vez), límite de comprobantes |
| `files-upload.test.mjs` / `storage-access.test.mjs` | D. Subidas hostiles por la app; acceso a Storage: rutas adivinadas, URLs firmadas vencidas o alteradas, listados, recorrido de rutas |
| `public-surface.test.mjs` | E y F y G. Inyección y parámetros extraños, contenido hostil en contacto, enumeración de cuentas, redirecciones, CSRF, límites de uso, IP falsas, cuerpos gigantes, ráfagas |
| `session-auth.test.mjs` / `zz-logout.test.mjs` | F. Cookie de recuperación falsificada, cambio de contraseña, límites, cierre de sesión |
| `config-headers.test.mjs` | H. Cabeceras de seguridad, métodos, CORS, errores sin trazas, rutas de desarrollo, mapas de código, robots y sitemap |

Lo que crean las pruebas lleva el prefijo `zz-sec-` (productos, categorías, descuentos, pedidos, mensajes, archivos). **No borran nada**: los pedidos de prueba se hacen vencer por la vía normal y los descuentos se desactivan. La limpieza es un SQL que revisas y corres tú: [`supabase/tests/attack/limpieza-zz-sec.sql`](supabase/tests/attack/limpieza-zz-sec.sql).

Efectos secundarios a conocer: gastan los contadores de intentos (login, contacto, comprobantes y cambio de contraseña) de las cuentas de prueba; se vencen solos en 15 a 60 minutos. Los límites **por IP** usan una IP propia por ejecución, para no gastar el contador de `127.0.0.1`.

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
src/lib/supabase/     clientes de Supabase (servidor con sesión, público sin sesión, service_role)
src/lib/validation/   esquemas Zod
src/lib/auth.ts       getUser, getRole, requireAdmin
src/proxy.ts          refresco de sesión y protección de /admin
supabase/             migraciones, semilla y pruebas
prototipos/           solo referencia visual (fuera de TypeScript y ESLint)
```

## Seguridad

### Cabeceras de seguridad

Están en [`next.config.ts`](next.config.ts): CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS de 2 años con subdominios (sin `preload` hasta confirmar el dominio) y `Cross-Origin-Opener-Policy: same-origin`.

**CSP: un solo interruptor.** La política se arma en [`src/lib/csp.ts`](src/lib/csp.ts) y hoy se publica como `Content-Security-Policy-Report-Only`: no bloquea nada y las infracciones salen en la consola del navegador. Para pasar a modo de bloqueo:

1. Recorre la tienda, el checkout, la subida de comprobantes, el login con Turnstile y el panel (incluido el QR del 2FA y el visor de comprobantes) con la consola abierta y confirma que no aparezcan avisos de "Content-Security-Policy".
2. En `next.config.ts` cambia `const CSP_ENFORCE = false;` por `true` y vuelve a desplegar.
3. Repite el recorrido. Para volver atrás, `false` y desplegar.

Es una CSP sin nonce porque el proyecto usa `cacheComponents` (prerenderizado parcial), que la guía de Next declara incompatible con nonces; por eso los scripts en línea se permiten con `'unsafe-inline'`. Aun así bloquea scripts, marcos y conexiones de otros sitios, `<object>`, el cambio de `<base>`, el envío de formularios a otros dominios y que la tienda se muestre dentro de otra página.

### Otras reglas

- `.env.local` nunca se sube. La clave `service_role` solo va en variables de entorno del servidor.
- Precios y totales se calculan siempre en el servidor; el navegador solo envía IDs y cantidades.
- Los comprobantes de pago viven en un bucket privado; el admin los ve con URLs firmadas temporales.
- Detalle y checklist completa en la sección 10 de [CLAUDE.md](CLAUDE.md).
