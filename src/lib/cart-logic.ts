// Reglas puras del carrito (sin `window`, sin React, sin servidor): las líneas, sus topes y la
// fusión del carrito del invitado con el de la cuenta. Las usan el almacén del navegador, las
// acciones de servidor y las pruebas. Sin "use client" ni `@/` a propósito, para probarlas con node:test.
//
// Diseño (resumen):
//  - Invitado: el carrito vive en localStorage (lista de { productId, cantidad }).
//  - Con sesión: vive en la base de datos, ligado al usuario (tabla `cart_items`).
//  - Solo producto y cantidad. Nunca precios ni nombres: los calcula siempre el servidor.

import { z } from "zod";

/** Productos distintos por carrito (igual que `create_order` y la tabla `cart_items`). */
export const MAX_LINES = 50;
/** Unidades por línea (igual que la restricción de `cart_items.cantidad`). */
export const MAX_QUANTITY = 99;

export const itemSchema = z.object({
  productId: z.uuid(),
  cantidad: z.number().int().min(1).max(MAX_QUANTITY),
});
export const cartSchema = z.array(itemSchema).max(MAX_LINES);

export type CartItem = z.infer<typeof itemSchema>;

export const EMPTY_ITEMS: CartItem[] = [];

// ---------------------------------------------------------------------------
// Copia local del invitado
// ---------------------------------------------------------------------------

/**
 * Lee lo guardado en localStorage. Lo puede editar cualquiera, así que se valida.
 * Vacío, dañado o inválido: carrito vacío. (Un formato anterior con dueño se descarta: el carrito
 * de una cuenta vive en el servidor, nunca en el navegador.)
 */
export function parseGuestCart(raw: string | null): CartItem[] {
  if (!raw) return EMPTY_ITEMS;
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.length > 0 ? parsed.data : EMPTY_ITEMS;
  } catch {
    return EMPTY_ITEMS;
  }
}

/** Texto para guardar, o null si no hay nada que guardar (se borra la clave). */
export function serializeGuestCart(items: readonly CartItem[]): string | null {
  return items.length === 0 ? null : JSON.stringify(items);
}

// ---------------------------------------------------------------------------
// Operaciones sobre las líneas (las usa la copia local y la actualización optimista)
// ---------------------------------------------------------------------------

/** Suma `cantidad` al producto sin pasar de `max` (unidades disponibles) ni de MAX_QUANTITY. */
export function addLine(items: readonly CartItem[], productId: string, cantidad: number, max: number): CartItem[] {
  const limit = Math.min(max, MAX_QUANTITY);
  const existing = items.find((i) => i.productId === productId);
  if (existing) {
    return items.map((i) =>
      i.productId === productId ? { ...i, cantidad: Math.min(i.cantidad + cantidad, limit) } : i,
    );
  }
  if (items.length >= MAX_LINES || limit < 1) return [...items];
  return [...items, { productId, cantidad: Math.min(cantidad, limit) }];
}

export function setLine(items: readonly CartItem[], productId: string, cantidad: number): CartItem[] {
  const clamped = Math.min(Math.max(Math.trunc(cantidad), 1), MAX_QUANTITY);
  return items.map((i) => (i.productId === productId ? { ...i, cantidad: clamped } : i));
}

export function removeLine(items: readonly CartItem[], productId: string): CartItem[] {
  return items.filter((i) => i.productId !== productId);
}

// ---------------------------------------------------------------------------
// Fusión al iniciar sesión o registrarse
// ---------------------------------------------------------------------------

/** Lo que la tienda puede vender de un producto ahora. Ausente o null = inactivo o inexistente. */
export type Availability = ReadonlyMap<string, { disponible: number } | null>;

/**
 * Fusiona el carrito local del invitado (`local`) con el de la cuenta (`server`):
 *  - Los productos repetidos suman sus cantidades.
 *  - Cada línea se limita por el stock disponible y por MAX_QUANTITY.
 *  - Un producto agotado conserva lo que la cuenta ya tenía (se mostrará con aviso), pero no
 *    recibe lo del invitado. Uno inactivo o inexistente tampoco recibe nada del invitado.
 *  - Máximo MAX_LINES líneas: primero las de la cuenta, luego las del invitado.
 * Es el cálculo que hace la acción de servidor; el navegador solo lo usa para pruebas y vista previa.
 */
export function mergeCartLines(
  server: readonly CartItem[],
  local: readonly CartItem[],
  availability: Availability,
): CartItem[] {
  const serverQty = new Map<string, number>();
  const localQty = new Map<string, number>();
  const order: string[] = [];
  for (const i of server) {
    if (!serverQty.has(i.productId)) order.push(i.productId);
    serverQty.set(i.productId, (serverQty.get(i.productId) ?? 0) + i.cantidad);
  }
  for (const i of local) {
    if (!serverQty.has(i.productId) && !localQty.has(i.productId)) order.push(i.productId);
    localQty.set(i.productId, (localQty.get(i.productId) ?? 0) + i.cantidad);
  }

  const result: CartItem[] = [];
  for (const productId of order) {
    if (result.length >= MAX_LINES) break;
    const s = serverQty.get(productId) ?? 0;
    const l = localQty.get(productId) ?? 0;
    const product = availability.get(productId);

    let qty: number;
    if (!product) {
      qty = Math.min(s, MAX_QUANTITY);
    } else {
      const cap = product.disponible > 0 ? Math.min(MAX_QUANTITY, product.disponible) : 0;
      qty = Math.min(s + l, cap);
      // Agotado: se conserva lo que la cuenta ya tenía; el aviso lo muestra el carrito.
      if (qty <= 0 && s > 0) qty = Math.min(s, MAX_QUANTITY);
    }
    if (qty > 0) result.push({ productId, cantidad: qty });
  }
  return result;
}
