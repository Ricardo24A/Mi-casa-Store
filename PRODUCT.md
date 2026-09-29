# Product

<!-- impeccable:product-schema 1 -->

Contexto de producto para las herramientas de diseño. La fuente de verdad es `CLAUDE.md` (especificación, paleta, secciones 3, 4, 6 y 7); este archivo no la duplica y, ante cualquier diferencia, manda `CLAUDE.md`. Respondido por el equipo de desarrollo a partir de `CLAUDE.md`, sin entrevista.

## Platform

web

## Users

- **Comprador** (Ecuador, sobre todo en celular): busca productos para el hogar entre $1 y $100, compara, arma un carrito y paga por transferencia bancaria subiendo el comprobante. Compra sin cuenta.
- **Dueño de la tienda**: administra catálogo, descuentos y pedidos desde el dashboard (fuera de este alcance visual).

## Product Purpose

Tienda online de productos para el hogar de un negocio nuevo en Ecuador. Éxito: que un comprador encuentre un producto, entienda el precio y complete el pedido con comprobante sin ayuda.

## Positioning

Tienda pequeña, ordenada y cercana, con catálogo curado por el dueño: solo se muestran categorías con productos reales. Pago únicamente por transferencia (sin pasarela ni tarjeta).

## Capabilities and Constraints

- Precios en USD; textos y fechas en español (`es-EC`).
- Solo se muestran categorías y subcategorías con productos activos.
- Sin pasarela de pagos; comprobante obligatorio.
- Pendiente de confirmar con el cliente: nombre y dominio definitivos, formato de precio (`$36,79`), envíos, descuento por transferencia, políticas de devolución y garantía.

## Brand Commitments

- Nombre de trabajo: **Mi casa Store**.
- Tono: minimalista, ordenado y cálido; mucho espacio en blanco, sin adornos.
- Paleta y tipografía definidas en `CLAUDE.md` sección 3 (fondo `#F0DFC6`, verde `#3E5C4B`, ofertas en terracota). El cliente pidió más verde, sobre todo en las categorías.
- Iconos SVG (`lucide-react`), nunca emojis. No copiar textos, imágenes ni marca de otras tiendas.

## Evidence on Hand

- Prototipos aprobados en `prototipos/cliente/` (solo referencia visual y de flujo).
- No existen aún: reseñas, cifras de clientes, garantías, políticas de envío ni devolución, ni fotos reales. **No inventarlos** (nada de "4.8★", "12K+ clientes", "envío gratis", "garantía", "pago 100% seguro"). Tampoco la sección "Compra con confianza" en el home.

## Product Principles

1. Honestidad ante todo: solo datos y promesas confirmados por el cliente.
2. Primero el celular: comprar debe ser cómodo con una mano.
3. Calma y claridad: pocas cosas por pantalla, jerarquía obvia, precio siempre legible.
4. Calidez sin ruido: el verde y el crema dan identidad; el movimiento es sutil y nunca decorativo.

## Accessibility & Inclusion

Contraste mínimo 4.5:1 en texto pequeño, áreas táctiles de 44 px, foco visible y respeto de `prefers-reduced-motion`.
