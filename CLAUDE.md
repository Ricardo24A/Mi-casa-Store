# Tienda online de productos para el hogar

Especificaciones, estructura y fases de desarrollo. Claude Code lee este archivo al inicio de cada sesión.

## 1. Resumen

Tienda online para un cliente de Ecuador que vende productos para el hogar. Dos vistas:

- **Cliente**: catálogo por categorías, carrito, checkout y pago por transferencia con comprobante.
- **Dueño (dashboard)**: productos, categorías, precios, descuentos y pedidos.

Precios de productos entre $1 y $100. Negocio nuevo. **No hay pasarela de pagos: el único método de pago es transferencia bancaria**, y el comprador sube la evidencia al pagar desde el carrito. Debe salir a producción, así que la seguridad no es opcional.

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

## 5. Dashboard del dueño

### Alta de producto (flujo)

1. Elegir **categoría**.
2. Elegir **subcategoría**.
3. Lista de **productos comunes precargados** (plantillas) que rellenan el formulario, u opción **"Otro producto (manual)"**.
4. Completar precio, stock, imágenes y guardar. Todos los campos son editables.

Las plantillas ya existen en `prototipos/cliente/src/data/index.ts` (`presetProductsBySubcategory`, 65, con nombre, descripción, precio sugerido y prefijo de SKU). Usarlas como semilla de `product_templates` en la Fase 1.

### Funciones

- Login del dueño con 2FA.
- CRUD de productos: nombre, descripción, precio, stock, SKU, activo/inactivo, varias imágenes.
- Gestión de categorías y de plantillas de productos comunes.
- **Descuentos**: porcentaje o monto fijo; a un producto, una categoría o toda la tienda; con fechas; cupón opcional.
- **Pedidos**: listado, detalle y estados: pendiente de pago, comprobante recibido, pagado, enviado, entregado, rechazado, cancelado o vencido.
- **Revisión de comprobantes**: ver la imagen o PDF subido junto al monto y la referencia del pedido, y aprobar o rechazar (con motivo que se notifica al cliente).
- Configuración: datos del negocio, cuentas bancarias para transferencia, costo y regla de envío, porcentaje de descuento por transferencia, tiempo límite para pagar.
- Panel resumen: ventas recientes, pedidos por revisar, productos con poco stock.

## 6. Vista del cliente

- Inicio (ver "Contenido del home" abajo).
- Catálogo por categoría y subcategoría, con búsqueda, filtros y orden.
- Página de producto: galería, precio, precio con descuento, stock, agregar al carrito.
- Carrito y checkout: datos de contacto, dirección de entrega y pago por transferencia.
- Pantalla de pago: cuentas bancarias del negocio, **monto exacto** y **código de referencia del pedido** para el concepto. El comprador **sube el comprobante** (imagen o PDF), que es **obligatorio** para confirmar el pedido.
- Confirmación: "Recibimos tu comprobante, lo revisaremos". El pedido no está "pagado" hasta que el dueño lo apruebe.
- Seguimiento del estado del pedido y opción de subir otro comprobante si fue rechazado.
- Páginas: contacto, privacidad, términos y envíos. Responsive, pensada primero para celular.
- Rutas en español, como en el prototipo: `/catalogo`, `/categoria/[id]`, `/producto/[id]`, `/carrito`, `/checkout`, `/confirmacion`, `/admin/...`.

### Contenido del home

Estructura: header, hero simple, categorías, "Más populares", "Ofertas especiales" (productos reales con descuento) y footer.

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
| Login admin | Credenciales fijas (`admin123`) | Solo demo. En producción: Supabase Auth con 2FA. Nada de credenciales en el código |
| Iconos | Emojis | SVG (`lucide-react`) |
| "Mi cuenta" | "Próximamente" | Pendiente: compra como invitado o cuenta opcional |
| Datos | Productos, pedidos y descuentos de ejemplo en `data/index.ts` | Solo se aprovechan categorías y plantillas como semilla; lo demás es de ejemplo |

## 8. Flujo de pago por transferencia

1. El cliente confirma el carrito. El servidor recalcula el total desde la base de datos y crea el pedido en `pendiente de pago` con un código de referencia único.
2. **El stock se reserva** hasta un tiempo límite (definido en configuración). Si vence sin comprobante, el pedido pasa a `vencido` y el stock se libera.
3. El cliente sube el comprobante, y el pedido pasa a `comprobante recibido`. Se avisa al dueño por correo.
4. El dueño compara el comprobante con el estado de cuenta de su banco, y **aprueba o rechaza**. Al aprobar, pasa a `pagado` y se descuenta el stock definitivamente; al rechazar, el cliente puede volver a subir.
5. Correos al cliente en cada cambio relevante.

Riesgo principal: comprobantes falsos o editados. El dueño aprueba solo después de ver el dinero reflejado en su cuenta, nunca solo por la imagen. Mostrar esta advertencia en el dashboard.

## 9. Modelo de datos (borrador)

- `profiles` (id, rol: admin | customer)
- `categories` (id, parent_id, nombre, slug, orden)
- `product_templates` (id, category_id, nombre, descripcion_base, precio_sugerido, prefijo_sku)
- `products` (id, category_id, nombre, slug, descripcion, precio, stock, sku, activo, destacado)
- `product_images` (id, product_id, url, orden)
- `discounts` (id, tipo, valor, alcance, target_id, codigo, inicia, termina, activo)
- `orders` (id, referencia única, user_id o datos de invitado, estado, subtotal, descuento, envío, total, vence_en)
- `order_items` (id, order_id, product_id, nombre, precio_unitario, cantidad): guardar el precio al momento de la compra
- `payment_proofs` (id, order_id, archivo, hash, estado: en revisión | aprobado | rechazado, motivo, revisado_por, fecha)
- `store_settings` (datos del negocio, cuentas bancarias, envío, descuento por transferencia, tiempo límite de pago)

Toda tabla con RLS activo. Los clientes solo ven sus pedidos y comprobantes; solo el admin escribe en catálogo, ajustes y revisión de pagos.

## 10. Seguridad (checklist)

- [ ] RLS activo en todas las tablas y políticas probadas
- [ ] Rutas del dashboard protegidas por rol admin (proxy y servidor)
- [ ] Precios y totales calculados solo en servidor
- [ ] Validación con Zod en todas las entradas y acciones
- [ ] **Comprobantes**: bucket privado, acceso al admin solo con URLs firmadas temporales
- [ ] **Subida de archivos**: solo JPG, PNG o PDF, tamaño máximo (ej. 5 MB), verificar el tipo real del archivo (no solo la extensión), nombres generados por el servidor
- [ ] Hash del comprobante para detectar el mismo archivo usado en varios pedidos
- [ ] Rate limiting en login, checkout y subida de comprobantes
- [ ] Imágenes de productos en bucket con reglas claras (lectura pública, escritura solo admin)
- [ ] Secretos solo en variables de entorno, `.env` en `.gitignore`
- [ ] Cabeceras de seguridad (CSP, HSTS, X-Frame-Options), HTTPS obligatorio
- [ ] Cookies `httpOnly`, `secure`, `sameSite`
- [ ] 2FA para el dueño y contraseñas únicas; ninguna credencial de ejemplo en el código
- [ ] `npm audit` y dependencias actualizadas antes de publicar
- [ ] Backups automáticos de la base de datos
- [ ] Política de privacidad y consentimiento acordes a la normativa ecuatoriana de protección de datos personales (los comprobantes contienen datos bancarios)
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
- Layout, tema y menú de categorías, siguiendo el prototipo (con la paleta de la sección 3 y sin lo que indica la sección 6).
- Catálogo, filtros, búsqueda, página de producto y carrito.

### Fase 3: dashboard del dueño
- Login admin con 2FA.
- Alta de productos con plantillas y modo manual, subida de imágenes.
- CRUD de categorías, precios y stock, y descuentos.

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
- [ ] Fase 1 (SQL y código listos; falta que Ricardo revise y aplique `supabase/migrations` y `seed.sql`, y correr `supabase/tests/rls.test.sql` en desarrollo)
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
- Compra como invitado o cuenta de cliente.
- Facturación electrónica.

## 16. Notas técnicas del proyecto

- Next.js 16 (App Router). Tiene cambios respecto a versiones anteriores (por ejemplo, `middleware` ahora se llama `proxy`). Antes de escribir código, consultar la doc local en `node_modules/next/dist/docs/`.
- shadcn/ui no está instalado (su CLI necesita `ui.shadcn.com`). Escribir los componentes a mano con `cn()` de `src/lib/utils.ts`, o ejecutar `npx shadcn@latest init` en un equipo con acceso.
- Rutas: `src/app/(tienda)` para la vista del cliente y `src/app/(admin)` para el dashboard.
- Supabase: clientes en `src/lib/supabase/` (`client.ts` para navegador, `server.ts` para servidor). Variables en `.env.local` (ver `.env.example`).
- `prototipos/` es solo referencia: está excluido de TypeScript (`tsconfig.json`) y de ESLint. No importar nada desde ahí.

@AGENTS.md
