# Tienda online de productos para el hogar

Especificaciones, estructura y fases de desarrollo. Claude Code lee este archivo al inicio de cada sesión.

## 1. Resumen

Tienda online para un cliente de Ecuador que vende productos para el hogar. Dos vistas:

- **Cliente**: catálogo por categorías, carrito, checkout y pago por transferencia con comprobante.
- **Dueño (dashboard)**: productos, categorías, precios, descuentos y pedidos.

Precios típicos entre $1 y $100, sin tope técnico (el dueño decide el precio de cada producto; solo debe ser mayor que 0). Negocio nuevo. **No hay pasarela de pagos: el único método de pago es transferencia bancaria**, y el comprador sube la evidencia al pagar desde el carrito. Debe salir a producción, así que la seguridad no es opcional.

Hay dos prototipos aprobados por el cliente:

- **Vista del cliente** (Figma Make): código de referencia en `prototipos/cliente/`.
- **Dashboard** (Lovable): enlace guardado por Ricardo.

Son la referencia visual y de flujo; el código final se construye con el stack de abajo. **Donde un prototipo contradiga este documento (pagos, datos de Colombia, promesas comerciales, marca "Nido Hogar"), manda este documento.** Ver sección 7.

## 2. Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Servidor y frontend en un solo proyecto, claves seguras |
| Estilos | Tailwind CSS (v4) | Interfaz limpia y rápida de construir |
| Base de datos y auth | Supabase (Postgres, Auth, Storage) | Login, RLS, imágenes y comprobantes |
| Validación | Zod | Validar toda entrada en servidor |
| Iconos | lucide-react | Iconos SVG (no emojis) |
| Correos | Resend (o similar) | Confirmaciones de pedido y de pago |
| Hosting | Vercel | HTTPS automático, variables de entorno |

Regla: no escribir autenticación propia.

## 3. Diseño

Minimalista, ordenado, mucho espacio en blanco, sin adornos. Se sigue la línea de los prototipos aprobados, con estos ajustes.

**Paleta** (tokens en `src/app/globals.css`; el cliente pidió un fondo más subido que el del prototipo)

| Uso | Color | Token |
|---|---|---|
| Fondo base | `#F0DFC6` | `bg` |
| Secciones alternas | `#E9D3B4` | `bg-alt` |
| Superficies (tarjetas, header, inputs) | `#FFFFFF` | `surface` |
| Fondo de imágenes de producto | `#F9F1E6` | `soft` |
| Bordes | `#D9C5A6` | `line` |
| Texto principal | `#2A2521` | `ink` |
| Texto secundario | `#5E554B` | `ink-soft` |
| Acento (botones, enlaces, precios) | `#3E5C4B` | `accent` |
| Acento al pasar el cursor | `#2E4437` | `accent-hover` |
| Fondos suaves del acento | `#EDF3EF` y `#D1E4D9` | `accent-soft`, `accent-mid` |
| Ofertas y etiquetas (relleno o texto grande) | `#B8623F` | `sale` |
| Texto pequeño de oferta | `#94462A` | `sale-ink` |
| Fondo de etiquetas de oferta | `#F8EDE8` | `sale-soft` |

Notas de contraste sobre el fondo base: el texto principal (11.6:1), el secundario (5.6:1) y el verde (5.7:1) pasan AA. La terracota `#B8623F` no pasa en texto pequeño (3.3:1): para texto chico usar `sale-ink`. El borde `#E6DBC9` del prototipo casi no se ve sobre el nuevo fondo, por eso se usa `#D9C5A6`.

**Tipografía**: DM Sans, pesos 400 y 600 (la usa el prototipo), cargada con `next/font/google`. Por ahora el proyecto usa fuentes del sistema.

**Iconos**: SVG con `lucide-react`. Los prototipos usan emojis (💳 🏦 🚚 ⏳); no llevarlos al producto.

Bordes redondeados moderados, sombras casi nulas, imágenes de producto con proporción fija 1:1. Menú superior con categorías y desplegable de subcategorías; en móvil, menú lateral. Animaciones sutiles y rápidas. No copiar textos, imágenes ni marca de tiendas de referencia.

Nombre de trabajo: **Mi casa Store** (confirmar nombre y dominio).

## 4. Categorías

Ocho categorías de primer nivel, con subcategorías, ya definidas en `prototipos/cliente/src/data/index.ts` (`categories`). Usarlas como semilla:

Electrodomésticos, Tecnología, Baño, Dormitorio, Comedor, Cocina, Exteriores, Decoración y muebles.

Ejemplos: **Cocina** (Utensilios, Organización, Cocción, Almacenamiento, Cuchillería, Textil para cocina) y **Dormitorio** (Ropa de cama, Organización y decoración, Muebles, Descanso).

Las imágenes de categoría y de producto del prototipo son de Unsplash y de ejemplo. Las reales las sube el dueño.

### Visibilidad de categorías (requisito del cliente)

Las categorías y subcategorías **siempre existen en la base de datos** (el dueño las necesita para dar de alta productos), pero **la tienda solo muestra las que tienen productos**:

- Una **subcategoría** es visible si tiene al menos un producto **activo**.
- Una **categoría** es visible si alguna de sus subcategorías visibles tiene productos. Se muestra con sus subcategorías visibles y sus productos; las subcategorías vacías no aparecen.
- Ejemplo: si el dueño solo publica una freidora de aire en Electrodomésticos → Freidoras de aire, en la tienda aparece únicamente "Electrodomésticos" con esa subcategoría y ese producto. Las otras siete categorías no se ven.
- El dueño también puede **desactivar** una categoría o subcategoría (`activa = false`): desaparece de la tienda junto con sus subcategorías y sus productos, aunque tengan productos activos. Es distinto de "oculta por estar vacía": el dashboard las muestra con etiquetas distintas ("Desactivada" y "Oculta en la tienda: sin productos activos"). La regla está en la base de datos (`category_visible()`, la vista y la política de `products`), no solo en la interfaz.
- Se aplica en **todos** los lugares de la vista del cliente: menú principal, sección de categorías del home, filtros del catálogo, buscador y sitemap.
- Si alguien abre a mano la URL de una categoría o subcategoría sin productos, responder **404** (no una página vacía).
- Si la tienda todavía no tiene ningún producto activo, el home muestra un mensaje sencillo ("Estamos preparando el catálogo") en lugar de categorías vacías.
- El resultado se actualiza solo: al crear, activar, desactivar o eliminar un producto en el dashboard, invalidar la caché de las páginas afectadas (`revalidateTag` / `revalidatePath`).
- Un producto agotado (stock 0) pero **activo** sigue contando y se muestra como "Agotado". Para ocultarlo, el dueño lo desactiva.

## 5. Dashboard del dueño

### Alta de producto (flujo)

1. Elegir **categoría**.
2. Elegir **subcategoría**.
3. Lista de **productos comunes precargados** (plantillas) que rellenan el formulario, u opción **"Otro producto (manual)"**.
4. Completar precio, stock, imágenes y guardar. Todos los campos son editables.

Las plantillas ya existen en `prototipos/cliente/src/data/index.ts` (`presetProductsBySubcategory`, 65, con nombre, descripción, precio sugerido y prefijo de SKU). Usarlas como semilla de `product_templates` en la Fase 1.

### Funciones

- Login del dueño: el login único de la tienda (`/login`, ver "Acceso y compra" en la sección 6) y 2FA obligatorio antes de entrar al panel.
- CRUD de productos: nombre, descripción, precio, stock, SKU, activo/inactivo, varias imágenes.
- Gestión de categorías y de plantillas de productos comunes. El formulario de alta de producto lista **todas** las categorías; el listado de categorías del dashboard marca con una etiqueta ("Oculta en la tienda: sin productos activos") las que aún no tienen productos.
- **Descuentos**: porcentaje o monto fijo; a un producto, una categoría o toda la tienda; con fechas de inicio y fin opcionales (en hora de Ecuador); cupón opcional (la tienda aún no acepta cupones, así que el dashboard no los crea). Reglas de acumulación: los descuentos de productos **no se suman**, a cada producto se le aplica solo el que más rebaja; un monto fijo se descuenta por unidad; ningún descuento deja un producto gratis (queda al menos 1 centavo) y el porcentaje es menor que 100; el descuento por transferencia de Configuración se aplica además, sobre el precio ya rebajado. El dueño nunca escribe un precio final: solo tipo y valor, y el servidor calcula siempre el precio.
- **Pedidos**: listado, detalle y estados: pendiente de pago, comprobante recibido, pagado, enviado, entregado, rechazado, cancelado o vencido.
- **Revisión de comprobantes**: ver la imagen o PDF subido junto al monto y la referencia del pedido, y aprobar o rechazar (con motivo que se notifica al cliente).
- Configuración: datos del negocio, cuentas bancarias para transferencia, costo y regla de envío, porcentaje de descuento por transferencia, tiempo límite para pagar.
  Reglas: todo vacío es "sin definir" y la tienda funciona sin ello (nada de cifras inventadas). Costo de envío vacío = "A coordinar" (0 = gratis a propósito); "envío gratis desde" exige costo de envío. Plazo de pago de 1 a 168 horas (aplica a pedidos nuevos). Descuento por transferencia de 0 a menos de 100. Sin cuentas bancarias el checkout no deja pagar ni crea pedidos. Las cuentas y reglas de cobro no son públicas: las lee solo el servidor (`getCheckoutSettings`); lo único público es nombre, contacto, horario de atención y Facebook (pie y /contacto) por la vista `store_public_info` (`getPublicStoreInfo`, etiqueta de caché `tienda`). Las URLs de redes deben ser https. Teléfonos del negocio (principal y secundario opcional): se guardan normalizados, solo dígitos y en formato nacional (celular de 10 dígitos `09` + 8, fijo de 9 dígitos con código `02` a `07`), con la misma regla en Zod (`src/lib/phone-ec.ts`) y en la base (`valid_ec_phone`); se muestran como `099 123 4567` / `(04) 234 5678`, el enlace `tel:` usa `+593` sin el 0 y un celular lleva además el icono de WhatsApp (`wa.me/593…`) en el pie. Esta regla es solo del negocio: el teléfono del comprador tiene la suya, más flexible.
- **Mensajes** (`/admin/mensajes`): bandeja de lo que llega por /contacto, con filtros (nuevos, leídos, archivados), contador de no leídos en el menú y en el Resumen, detalle con enlaces para responder por correo (`mailto:`), WhatsApp (si es celular) y teléfono, y acciones "Marcar leído" (nuevo → leído) y "Archivar" (nuevo o leído → archivado), cada una con su función de base de datos (`admin_mark_message_read`, `admin_archive_message`).
- Panel resumen: ventas recientes, pedidos por revisar, productos con poco stock.
  El Resumen (`/admin`) lee todo de la base de datos con `admin_dashboard_summary` y `admin_stock_alerts` (solo admin con 2FA): comprobantes por revisar y pendientes de pago con enlace a cada pedido, pagados por enviar, ventas de hoy y del mes (hora de Ecuador; solo pedidos pagado, enviado o entregado, por `pagado_en`) con su ticket promedio (sin pedidos no se muestra), pedidos por estado, productos agotados (stock 0) y con poco stock (disponible = stock menos reservado, menor o igual que el umbral de Configuración) y los últimos pedidos. Sin datos, estados vacíos; nunca cifras inventadas.

### Prototipo del dashboard (Lovable): qué tomar y qué cambiar

Referencia de estructura y flujo. El diseño real usa el mismo sistema visual que la tienda (paleta #F0DFC6 y verde #3E5C4B, componentes propios). El prototipo se revisó en ancho móvil: verificar también escritorio (menú lateral fijo, tablas anchas).

**Estructura.** Menú lateral (cajón en móvil): Resumen, Productos, Categorías, Descuentos, Pedidos (con contador de pendientes) y Configuración; al pie, el usuario y "Salir". Campana de avisos arriba a la derecha.

| Pantalla | Qué trae el prototipo | Qué cambiar en el real |
|---|---|---|
| Login | Correo, contraseña y código de 2 pasos, con datos prellenados | Sin credenciales prellenadas ni fijas. Ya no tiene pantalla propia: usa el login único de la tienda (`/login`). 2FA (TOTP de Supabase) obligatorio, no opcional, en `/admin/2fa` y `/admin/verificar`. |
| Resumen | Saludo con nombre, botón "Nuevo producto", 4 tarjetas (ventas del mes, pedidos pendientes, por aprobar, poco stock), gráfico de 30 días, lista de inventario bajo | Nombre desde `profiles`, no fijo. Datos reales. "Ventas" cuenta solo pedidos pagado, enviado o entregado. Sin "% vs mes anterior" si no hay datos. Umbral de poco stock configurable (por defecto 5). |
| Productos | Búsqueda, filtros por categoría y estado, tabla (imagen, nombre, SKU, categoría, precio con precio anterior tachado, stock en rojo si es bajo) | SKU opcional. Paginación. Editar, activar/desactivar. No eliminar productos con pedidos (desactivarlos). |
| Nuevo producto | Asistente de 4 pasos: categoría, subcategoría, plantilla u "Otro producto (manual)", detalles (nombre*, SKU, descripción, precio*, unidades, activo, imágenes múltiples). Botones "Guardar producto" y "Guardar y agregar otro" | Mantener el flujo. La plantilla rellena nombre, descripción, precio sugerido y prefijo de SKU. Añadir "destacado". Validar imágenes (JPG/PNG/WebP, **4 MB** por el límite de Vercel, tipo real en el servidor); el navegador las reduce a 1600 px antes de subirlas; máximo 8 por producto; elegir portada y orden. El stock no puede quedar por debajo de lo reservado por pedidos (lo impide la base de datos y el formulario lo explica). |
| Categorías | Árbol con icono, contador, editar, borrar, reordenar con flechas, "Añadir subcategoría" y "Nueva categoría" | No borrar categorías con productos. Etiqueta "Oculta en la tienda" si no tiene productos activos. Slug automático. Imagen opcional. |
| Descuentos | Tabla (nombre, tipo, aplica a, vigencia) y modal (nombre, tipo % o monto, valor, aplicar a, fechas, cupón opcional, vista previa) | Mantener. Añadir alcance por producto, estado (activo/vencido), activar/desactivar, editar y eliminar. Quitar el aviso de "demostración". |
| Pedidos | Filtros por estado y por pago; tabla (#, cliente, fecha, total, método, estado); modal con productos, cliente y entrega, comprobante, "Cambiar estado", "Rechazar" y "Aprobar pago" | Quitar "Tarjeta" y el filtro de pago (solo transferencia). Mostrar referencia `MC-XXXXXXXX`, monto del pedido, fecha de subida y el archivo (imagen o PDF) con URL firmada temporal. "Rechazar" exige motivo. "Aprobar" solo si hay comprobante en revisión. El estado no es un desplegable libre: solo transiciones válidas mediante botones. El envío es un campo del pedido, no un producto. Cancelar o vencer libera el stock reservado. Todo mediante acciones de servidor. |
| Configuración | Datos del negocio, una cuenta bancaria (banco, número, titular), costo de envío y descuento por transferencia (%), seguridad (interruptor de 2FA, cambiar contraseña) | Varias cuentas bancarias, con tipo de cuenta e identificación. Añadir envío gratis desde (opcional), plazo de pago en horas y enlaces de redes. 2FA siempre obligatorio. Cambiar contraseña exige reautenticar. |

**Falta en el prototipo y hay que diseñar:** estados de carga, vacío y error; qué muestra la campana (pedidos con comprobante nuevo); pantalla de detalle de pedido a página completa en móvil si el modal queda estrecho.

**Categorías:** el árbol del prototipo del dashboard difiere del prototipo de clientes (por ejemplo, Electrodomésticos trae Pequeños electrodomésticos, Limpieza y Climatización). Se mantiene la semilla ya aplicada en Supabase; el dueño la edita desde Categorías.

## 6. Vista del cliente

- Inicio (ver "Contenido del home" abajo).
- Catálogo por categoría y subcategoría, con búsqueda, filtros y orden. **Solo aparecen las categorías y subcategorías que tienen productos activos** (ver sección 4, "Visibilidad de categorías").
- Página de producto: galería, precio, precio con descuento, stock, agregar al carrito.
- Carrito y checkout: datos de contacto, dirección de entrega y pago por transferencia. **Para pagar hay que iniciar sesión** (ver "Acceso y compra").
- Pantalla de pago: cuentas bancarias del negocio, **monto exacto** y **código de referencia del pedido** para el concepto. El comprador **sube el comprobante** (imagen o PDF), que es **obligatorio** para confirmar el pedido.
- Confirmación: "Recibimos tu comprobante, lo revisaremos". El pedido no está "pagado" hasta que el dueño lo apruebe.
- Seguimiento del estado del pedido y opción de subir otro comprobante si fue rechazado.
- Páginas: contacto, privacidad (`/privacidad`), términos (`/terminos`), cookies (`/cookies`) y envíos. El texto legal es del cliente y se publica tal cual desde `src/content/legal/` (con versión por documento, `LEGAL_VERSIONS`); en los Términos el plazo de pago es el real de `horas_limite_pago`. Registro y checkout exigen la casilla "Acepto los Términos y Condiciones y la Política de Privacidad", validada en el servidor, y guardan cuándo y qué versión (`terminos_aceptados_en`, `terminos_version` en `profiles` y `orders`). Responsive, pensada primero para celular.
- **Contacto** (`/contacto`, enlazada en el menú y el pie): arriba, solo los datos de Configuración que existan (teléfonos con `tel:` y WhatsApp si es celular, correo, dirección, horario de atención y Facebook); debajo, un formulario (nombre, correo, teléfono de Ecuador con la regla de `phone-ec.ts`, asunto opcional, mensaje de 10 a 1000 caracteres y la casilla obligatoria de tratamiento de datos; sin cédula). Contra spam: Turnstile, campo trampa `sitio_web` y límite en la base (3 por correo y 10 por IP por hora; el IP se guarda solo como HMAC y se borra al día). Se guarda como texto plano (sin etiquetas HTML) y el panel lo muestra escapado. El texto de la casilla de aceptación debe validarlo el cliente.
- Rutas en español: `/catalogo`, `/categoria/[slug]` (el slug puede ser de una categoría o de una subcategoría; son únicos en toda la tabla), `/producto/[slug]`, `/carrito`, `/checkout`, `/confirmacion`, `/admin/...`.

### Acceso y compra (decidido con el cliente)

**Un solo login para clientes y administrador.** Reemplaza la regla anterior de rechazar al administrador en el login de clientes: ya no hay dos accesos.

- Ruta única `/login` (más `/registro`, `/recuperar` y `/nueva-clave`). `/admin/login` y `/cuenta/login` (y los equivalentes de registro y recuperación) solo redirigen a ella, conservando `next`.
- Pantalla completa, sin el header ni el footer de la tienda, en dos columnas: a la izquierda el logo (`public/brand/logo-original.png`) sobre el fondo crema de la marca; a la derecha el formulario. Registro y recuperación usan el mismo diseño. Sin textos de marketing: el único lema es "Todo para tu hogar", que ya está en el home.
- Después de validar la contraseña: un `customer` va al `next` (solo si pasa `safeNext`) o al home; un `admin` va siempre a `/admin`, donde el proxy le pide registrar o verificar el 2FA. **Un admin nunca obtiene el panel sin sesión `aal2`**, y un cliente nunca entra a `/admin`.
- Mismos mensajes de error genéricos para cualquier fallo, Turnstile y validación con Zod. La pantalla no revela si un correo es de un administrador (el rol solo se conoce después de acertar la contraseña).
- Enlace visible "Continuar como invitado" que lleva al catálogo.

**Compra con cuenta obligatoria.** Sin sesión se puede ver el catálogo y las fichas de producto y usar el carrito (vive en el navegador). Al pagar sin sesión se lleva al login/registro con `next=/checkout` y el mensaje "Inicia sesión o crea una cuenta para pagar. Tu carrito se conserva"; al volver el carrito sigue intacto.

- **Carrito:** sin sesión vive en `localStorage`; con sesión vive en la base de datos (`cart_items`) y se conserva al cerrar sesión, al limpiar el navegador y entre dispositivos. Al iniciar sesión o registrarse se fusiona el carrito local con el de la cuenta (suma repetidos, limitado por stock y por el máximo por línea) y se borra la copia local. Al cerrar sesión se limpia la vista y la copia local, pero no se borra nada del servidor. Un usuario nunca ve el carrito de otro. Los productos desactivados o agotados se muestran con aviso y no pasan al checkout.
- La regla se aplica también en el servidor: la acción `crearPedido` rechaza si no hay usuario y guarda `user_id = auth.uid()` (`CHECKOUT_REQUIRES_ACCOUNT = true` en `src/config/site.ts`). La función SQL `create_order` exige un usuario y aparta el stock de forma atómica.
- El checkout no deja pagar sin nombre, teléfono y dirección de envío; los pide ahí mismo (`customer_addresses`, creando la dirección si no hay) y guarda nombre y teléfono en `profiles` si faltaban. No pide cédula ni datos de facturación (decisión pendiente, sección 15).

### Contenido del home

Estructura: header, hero simple, categorías (solo las que tienen productos), "Más populares", "Ofertas especiales" (productos reales con descuento) y footer.

- **NO poner la sección "Compra con confianza"**: el banner verde con "Envío a todo el país", "Garantía de satisfacción", envío gratis, devoluciones, pago seguro y garantía. El cliente no la quiere en el home.
- **No inventar cifras ni promesas.** El prototipo trae datos de ejemplo que no deben publicarse sin que el cliente los confirme: "4.8★ valoración media", "12K+ clientes felices", "100% garantía", "envío gratis desde $50", "devoluciones 30 días", "garantía 12 meses", "10% por suscribirte", "pago 100% seguro / encriptado". Hasta que el cliente confirme cada uno, no implementarlos.
- No poner en el footer enlaces a páginas que no existen (Blog, Sostenibilidad, Trabaja con nosotros, etc.).

## 7. Diferencias entre el prototipo del cliente y lo que hay que construir

| Tema | El prototipo | Construir |
|---|---|---|
| Pago | Opción "tarjeta" con número, vencimiento y CVV | **Quitar.** Solo transferencia. Nunca pedir ni guardar datos de tarjeta |
| Comprobante | "Opcional, puedes enviarlo después" | **Obligatorio** al confirmar el pedido; se sube en el checkout |
| Tras el pedido | "Pedido confirmado" y comprobante por correo a `pagos@nidohogar.com` | "Comprobante recibido, en revisión". Sin envío por correo; se sube en la web |
| País | Colombia: +57, Bogotá, departamento, NIT, "Banco de Occidente" | Ecuador: +593, provincia y ciudad, cédula/RUC (pendiente), bancos reales del cliente, fechas `es-EC`, USD |
| Marca | "Nido Hogar", `nidohogar.com`, `NID-` en el número de pedido | "Mi casa Store", datos y correos reales del cliente, prefijo propio |
| Envío | Fijo en el código: gratis desde $50, si no $8.99 | Configurable en el dashboard. Política pendiente del cliente |
| Descuento por transferencia | 5% fijo en el código | Porcentaje configurable en Configuración (0 = desactivado) |
| Estados de pedido | pendiente, pagado, enviado, entregado, cancelado | Agregar: comprobante recibido, rechazado, vencido |
| Login admin | Credenciales fijas (`admin123`) | Solo demo. En producción: login único de Supabase Auth (`/login`) y 2FA obligatorio. Nada de credenciales en el código |
| Iconos | Emojis | SVG (`lucide-react`) |
| "Mi cuenta" | "Próximamente" | `/cuenta`: mis pedidos, mis datos y direcciones. Cuenta obligatoria para pagar |
| Datos | Productos, pedidos y descuentos de ejemplo en `data/index.ts` | Solo se aprovechan categorías y plantillas como semilla; lo demás es de ejemplo |

## 8. Flujo de pago por transferencia

1. El cliente confirma el carrito. El servidor recalcula el total desde la base de datos y crea el pedido en `pendiente de pago` con un código de referencia único.
2. **El stock se reserva** hasta un tiempo límite (definido en configuración). Si vence sin comprobante, el pedido pasa a `vencido` y el stock se libera.
3. El cliente sube el comprobante, y el pedido pasa a `comprobante recibido`. Se avisa al dueño por correo.
4. El dueño compara el comprobante con el estado de cuenta de su banco, y **aprueba o rechaza**. Al aprobar, pasa a `pagado` y se descuenta el stock definitivamente; al rechazar, el cliente puede volver a subir.
5. Correos al cliente en cada cambio relevante.

**Comprobantes:** cada pedido tiene como máximo **un comprobante activo** (en revisión o aprobado) y **3 en total** (el resto queda como historial: rechazado con su motivo, o reemplazado). Mientras esté en revisión el cliente puede reemplazarlo; uno aprobado no se cambia. El plazo `vence_en` no se reinicia con un reemplazo y un pedido vencido no admite ni subida ni reemplazo. Si el dueño rechaza un comprobante, el pedido vuelve a `pendiente_pago` (conserva la reserva) y el cliente sube uno nuevo. Subir o reemplazar es una sola función de base de datos con el pedido bloqueado, para que una aprobación en paralelo no se pise. Un archivo de otro pedido con el mismo hash se avisa al dueño, nunca al comprador.

**Reserva de stock y estados** (todo en funciones de base de datos que bloquean el pedido primero y verifican el estado anterior; no hay UPDATE directo de `orders.estado` ni de `payment_proofs` por la API):

| Cambio | Desde | Hacia | Stock |
|---|---|---|---|
| Crear pedido (`create_order`; máximo 3 en `pendiente_pago` por usuario; las líneas deben ser las del carrito, que se bloquea y se vacía) | - | `pendiente_pago` | reserva |
| Vencer (`expire_orders`, cron cada 5 min) | `pendiente_pago` con plazo vencido | `vencido` | libera la reserva |
| Cancelar (`admin_cancel_order`) | `pendiente_pago`, `comprobante_recibido` | `cancelado` | libera la reserva |
| Rechazar el pedido (`admin_reject_order`) | `comprobante_recibido` | `rechazado` | libera la reserva |
| Rechazar el comprobante (`admin_reject_proof`) | `comprobante_recibido` | `pendiente_pago` con plazo **nuevo** | conserva la reserva |
| Aprobar (`admin_approve_order`) | `comprobante_recibido` | `pagado` | descuenta el stock y consume la reserva |
| Marcar enviado (`admin_mark_shipped`) | `pagado` | `enviado` | sin cambio (la reserva ya se consumió al aprobar) |
| Marcar entregado (`admin_mark_delivered`) | `enviado` | `entregado` | sin cambio |

`orders.reserva_activa` indica si el pedido tiene unidades reservadas: se libera o consume una sola vez, así que aprobar o liberar dos veces el mismo pedido es imposible. Un pedido con comprobante en revisión no vence: lo resuelve el dueño.

**Plazos acotados.** Cuando el dueño rechaza un comprobante, el pedido vuelve a `pendiente_pago` con un plazo nuevo de `horas_limite_pago` contado desde el rechazo (el reemplazo de un comprobante en revisión **no** reinicia el plazo). Como un pedido admite como máximo 3 comprobantes, ese plazo nuevo se concede a lo sumo 3 veces: sin contar el tiempo que el pedido espera la revisión del dueño, un pedido mantiene stock reservado como máximo 4 × `horas_limite_pago` desde que se crea (el plazo inicial más hasta 3 nuevos). El tiempo en `comprobante_recibido` depende del dueño, que debe aprobar, rechazar o cancelar.

**Correos (Resend)** (`src/lib/email/`): al cliente, pedido creado (con cuentas y plazo), comprobante recibido, pago aprobado, comprobante rechazado (con motivo), pedido enviado, pedido cancelado y pedido rechazado (con motivo); al dueño, comprobante por revisar y mensaje de contacto nuevo. No hay correo de pedido entregado ni vencido. Se envían con `after()` una vez guardado el cambio, y un fallo nunca rompe el flujo. Sin `RESEND_API_KEY` quedan en simulación. Los correos de Supabase Auth no pasan por aquí.

Riesgo principal: comprobantes falsos o editados. El dueño aprueba solo después de ver el dinero reflejado en su cuenta, nunca solo por la imagen. Mostrar esta advertencia en el dashboard.

## 9. Modelo de datos

Aplicado en `supabase/migrations/`. Toda tabla tiene RLS activo y permisos (GRANT) explícitos: el proyecto no expone tablas automáticamente. Los clientes solo ven sus pedidos y comprobantes; solo el admin escribe en catálogo, ajustes y revisión de pagos; los pedidos y comprobantes los crea el servidor con `service_role`.

- `profiles` (id → auth.users, role: admin | customer, full_name, phone). Todo usuario nuevo es `customer`; el rol admin solo se asigna a mano en la base.
- `categories` (id, parent_id, nombre, slug único, imagen_url, orden). Dos niveles: categoría → subcategoría.
- `product_templates` (id, category_id → subcategoría, nombre, descripcion_base, precio_sugerido, prefijo_sku)
- `products` (id, category_id, nombre, slug único, descripcion, precio > 0 sin tope, stock, stock_reservado, sku único, activo, destacado)
- `product_images` (id, product_id, url en el bucket `product-images`, orden)
- `discounts` (id, nombre, tipo: porcentaje | monto_fijo, valor, alcance: producto | categoria | tienda, target_id, codigo de cupón opcional, inicia, termina, activo). El público solo lee los automáticos (sin cupón) y vigentes.
- `orders` (id, referencia única `MC-XXXXXXXX` generada por trigger, user_id opcional, contacto_nombre/email/telefono, documento opcional, direccion_envio jsonb, access_token, estado, subtotal, descuento, descuento_transferencia, envio, total, cupon, notas, vence_en). El total debe cuadrar: `subtotal - descuento - descuento_transferencia + envio`.
- `order_items` (id, order_id, product_id, nombre, precio_unitario, cantidad): precio y nombre congelados al comprar.
- `cart_items` (user_id, product_id, cantidad, created_at, updated_at; clave primaria `(user_id, product_id)`): carrito de la cuenta. Solo producto y cantidad, nunca precios. Máximo 50 líneas y cantidad 1 a 99. RLS: cada usuario solo ve y edita las suyas; `create_order` las vacía al crear el pedido.
- `payment_proofs` (id, order_id, archivo en el bucket privado `payment-proofs`, hash SHA-256, estado: en_revision | aprobado | rechazado, motivo, revisado_por, revisado_en). Un rechazo exige motivo.
- `store_settings` (una sola fila: datos del negocio, horario_atencion, cuentas_bancarias, costo_envio, envio_gratis_desde, descuento_transferencia_pct, horas_limite_pago)
- `profiles` y `orders` además guardan `terminos_aceptados_en` y `terminos_version` (constancia de aceptación; no editables por la API).
- `contact_messages` (id, nombre, email, telefono normalizado, asunto opcional, mensaje, aceptado_en, estado: nuevo | leido | archivado, created_at, leido_en, ip_hash temporal). Sin permisos de escritura por la API: se crea con `create_contact_message` (solo `service_role`) y cambia de estado con funciones admin; solo el admin con 2FA lee.
- `email_log` (tipo, referencia_id, destinatario_hash HMAC, destinatario_mascara, estado: pendiente | enviado | fallido | simulado | omitido, error o motivo corto, creado_en; única por tipo + referencia + destinatario): evita enviar dos veces el mismo correo. Solo lo lee el admin con 2FA; el servidor escribe con `email_log_claim` y `email_log_finish` (service_role). pg_cron borra lo de más de 90 días.
- `rate_limits` (bucket, clave HMAC, ventana_inicio, expira_en, intentos): límite de intentos de las acciones de servidor. Nadie la lee por la API; solo `rate_limit_hit()` (service_role) y `cleanup_rate_limits()` (pg_cron, cada hora).
- Vista `visible_categories`: categorías y subcategorías con al menos un producto activo (sección 4).

Reglas en la base de datos: un pedido no pasa a `comprobante_recibido` sin comprobante ni a `pagado` sin uno aprobado; `stock_reservado` no supera `stock`.

## 10. Seguridad (checklist)

- [x] RLS activo en todas las tablas y políticas probadas (`supabase/tests/rls.test.sql`)
- [ ] Rutas del dashboard protegidas por rol admin (proxy y servidor)
- [ ] Precios y totales calculados solo en servidor
- [ ] Validación con Zod en todas las entradas y acciones
- [ ] **Comprobantes**: bucket privado (hecho), acceso al admin solo con URLs firmadas temporales (Fase 5)
- [ ] **Subida de archivos**: solo JPG, PNG o PDF, tamaño máximo (ej. 5 MB), verificar el tipo real del archivo (no solo la extensión), nombres generados por el servidor
- [ ] Hash del comprobante para detectar el mismo archivo usado en varios pedidos
- [x] Rate limiting en login, checkout y subida de comprobantes (`src/lib/rate-limit.ts`, migración 21)
- [x] Imágenes de productos en bucket con reglas claras (lectura pública, escritura solo admin)
- [x] Secretos solo en variables de entorno, `.env` en `.gitignore`
- [ ] Cabeceras de seguridad (CSP, HSTS, X-Frame-Options), HTTPS obligatorio. Hechas en `next.config.ts` (HSTS sin `preload`, `Cross-Origin-Opener-Policy: same-origin`); falta pasar la CSP de Report-Only a bloqueo (README, "Cabeceras de seguridad")
- [ ] Cookies de sesión con `secure` y `sameSite=lax`; sin tokens en `localStorage`; XSS mitigado con la CSP (ver abajo) y sin HTML crudo en React. Nota: `@supabase/ssr` no usa `httpOnly` porque el navegador debe leer la sesión
- [ ] 2FA para el dueño y contraseñas únicas; ninguna credencial de ejemplo en el código
- [ ] `npm audit` y dependencias actualizadas antes de publicar
- [ ] Backups automáticos de la base de datos
- [ ] Política de privacidad y consentimiento acordes a la normativa ecuatoriana de protección de datos personales (los comprobantes contienen datos bancarios)
- [ ] **SMTP propio con Resend** para los correos de Supabase Auth (confirmar correo, recuperar contraseña); el correo integrado de Supabase solo sirve para pruebas
- [ ] **Turnstile** en registro, login y recuperación de clientes, con claves reales (sin `TURNSTILE_SECRET_KEY` en producción el servidor rechaza); el login único ya lo incluye también para el administrador
- [x] **Rate limiting propio** en login (cliente y admin), registro, recuperar contraseña, código 2FA, checkout y subida de comprobantes, además del límite de Supabase Auth. Reglas en `src/lib/rate-limit-core.ts`; falla cerrado en login, registro y pedidos, abierto en recuperar contraseña, 2FA y comprobantes
- [ ] **CSP sin nonce** (`src/lib/csp.ts`), publicada primero como Report-Only y con un interruptor (`CSP_ENFORCE` en `next.config.ts`) para pasar a bloqueo. Se descartó la CSP con nonce: el proyecto usa `cacheComponents` y la guía de Next indica que el prerenderizado parcial es incompatible con nonces (exigiría renderizar todo en cada visita). Permite `challenges.cloudflare.com` (script y frame de Turnstile), `data:` y `blob:` en `img-src` (QR del 2FA y vistas previas) y el dominio de Supabase para imágenes
- [ ] Revisión de seguridad final antes de producción

## 11. Fuera de alcance por ahora

- Pasarela de pagos y pagos con tarjeta (se puede agregar más adelante; el pedido y sus estados ya lo permiten).
- Verificación automática de transferencias.
- Facturación electrónica (SRI): definir con el cliente cómo la manejará.
- Newsletter y cuentas de cliente (hasta que el cliente los pida).
- App móvil nativa, multi-idioma y multi-moneda.
- Cálculo automático de envío por transportista.

## 12. Fases

Una sesión de trabajo por fase. Al terminar cada una: probar, hacer commit y actualizar "Estado".

### Fase 0: preparación
- Proyecto Next.js + TypeScript + Tailwind, proyecto Supabase, variables de entorno.
- Repositorio Git y despliegue base en Vercel.
- Con el cliente: dominio a su nombre, cuentas bancarias para transferencias.

### Fase 1: base de datos y seguridad base
- Esquema completo (sección 9), migraciones y RLS.
- Semilla de categorías y plantillas de productos (desde el prototipo).
- Auth con roles.

### Fase 2: vista del cliente
- **Primero**, una migración nueva (`supabase/migrations/`, la Fase 1 ya está aplicada en Supabase: no editar las anteriores) con la vista `public.visible_categories` para la regla de visibilidad (sección 4), con `security_invoker = true` para que respete RLS, que devuelva las categorías y subcategorías con al menos un producto activo, y con `grant select` explícito a `anon` y `authenticated` (el esquema tiene los permisos cerrados por defecto). Incluir pruebas en `supabase/tests/rls.test.sql`: una categoría sin productos activos no aparece, y aparece al activar un producto.
- Layout, tema y menú de categorías (solo las visibles, sección 4), siguiendo el prototipo (con la paleta de la sección 3 y sin lo que indica la sección 6).
- Catálogo, filtros, búsqueda, página de producto y carrito.

### Fase 3: dashboard del dueño
- Login admin con 2FA.
- Alta de productos con plantillas y modo manual, subida de imágenes.
- CRUD de categorías, precios y stock, y descuentos.
- Resumen con datos reales y Configuración (datos del negocio, cuentas bancarias, envío, descuento por transferencia, plazo de pago): la pantalla de pago de la siguiente fase depende de esos datos.
- La sección Pedidos del menú se agrega junto con su pantalla real en la fase de gestión de pedidos; no dejar enlaces que no lleven a nada.
- Cambios de catálogo por acciones de servidor con `requireAdmin()`, validación Zod e invalidación de la etiqueta `catalogo`.

### Fase 4: checkout y transferencia
- Checkout, creación de pedido con totales calculados en servidor y reserva de stock.
- Pantalla de pago con cuentas y referencia, subida segura del comprobante (obligatoria).
- Vencimiento automático de pedidos sin pago.

### Fase 5: gestión de pedidos y correos
- Pedidos en el dashboard, visor de comprobantes, aprobar/rechazar con motivo.
- Correos al cliente y al dueño en cada cambio de estado.

### Fase 6: seguridad, pruebas y lanzamiento
- Revisar toda la checklist de la sección 10.
- Pruebas de extremo a extremo en celular y computador (incluido subir archivos inválidos o demasiado grandes).
- Dominio, SSL, variables de producción, manual corto para el dueño.

## 13. Cómo trabajar con Claude (plan Pro)

- Una sesión por fase; no pedir la tienda entera de una vez.
- Tareas concretas por mensaje, por ejemplo "crea el CRUD de productos según la sección 5".
- Pegar solo el error exacto cuando algo falle.
- Revisar cada cambio antes de aceptarlo, sobre todo en autenticación, subida de archivos y permisos.
- Nunca dar credenciales de producción a la sesión de desarrollo.
- Al cerrar cada fase, pedir un resumen y actualizar "Estado".

## 14. Estado

- [x] Fase 0 (base creada; falta conectar Supabase y Vercel con las cuentas del cliente)
- [x] Fase 1 (esquema, RLS, buckets, seed y auth con roles aplicados; pruebas de RLS pasan)
- [ ] Fase 2
- [ ] Fase 3
- [ ] Fase 4
- [ ] Fase 5
- [ ] Fase 6

## 15. Decisiones pendientes

- Nombre definitivo y dominio de la tienda.
- Datos bancarios reales, y si se pide cédula o RUC al comprador.
- Envíos: costo fijo, por zona o retiro en tienda; y si habrá envío gratis desde cierto monto.
- Porcentaje de descuento por transferencia (el prototipo usa 5%).
- Políticas de devolución y garantía, si el cliente quiere publicarlas.
- Tiempo límite para subir el comprobante (ej. 24 o 48 horas).
- Facturación electrónica.
- Categorías: confirmar con el cliente que un producto agotado pero activo mantiene visible su categoría (así está definido por ahora).

## 16. Notas técnicas del proyecto

- Next.js 16 (App Router). Tiene cambios respecto a versiones anteriores (por ejemplo, `middleware` ahora se llama `proxy`). Antes de escribir código, consultar la doc local en `node_modules/next/dist/docs/`.
- shadcn/ui no está instalado (su CLI necesita `ui.shadcn.com`). Escribir los componentes a mano con `cn()` de `src/lib/utils.ts`, o ejecutar `npx shadcn@latest init` en un equipo con acceso.
- Rutas: `src/app/(tienda)` para la vista del cliente y `src/app/(admin)` para el dashboard.
- Supabase: clientes en `src/lib/supabase/` (`server.ts` con la sesión, `public.ts` sin sesión para el catálogo, `admin.ts` con service_role). El navegador no habla con Supabase. Los secretos del servidor (service_role, clave HMAC) están en `src/lib/server-env.ts`, con `server-only`. Variables en `.env.local` (ver `.env.example`); `NEXT_PUBLIC_SITE_URL` es obligatoria en producción (`src/lib/site-url.ts`).
- Contraseñas: `/nueva-clave` sirve a clientes y administrador. Sin el enlace de recuperación pide la contraseña actual; un admin con 2FA sin validar pide también el código. Al guardar se cierran todas las sesiones.
- Commits: título corto en español que describa el cambio (por ejemplo, "Catálogo con categorías visibles"). **No mencionar fases** ("Fase 2", etc.) ni en el título ni en el cuerpo.
- `prototipos/` es solo referencia: está excluido de TypeScript (`tsconfig.json`) y de ESLint. No importar nada desde ahí.

@AGENTS.md
