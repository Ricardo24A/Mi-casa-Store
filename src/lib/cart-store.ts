"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * Carrito del navegador. Guarda SOLO qué producto y cuántas unidades (nunca precios ni
 * nombres): los precios se piden a la base de datos cada vez que se muestra el carrito, y el
 * checkout los vuelve a calcular en el servidor. Lo que hay en localStorage lo puede editar
 * cualquiera, así que se valida con Zod al leerlo.
 */

const STORAGE_KEY = "mcs-cart-v1";
export const MAX_LINES = 50;
export const MAX_QUANTITY = 100;

const itemSchema = z.object({
  productId: z.uuid(),
  cantidad: z.number().int().min(1).max(MAX_QUANTITY),
});
const cartSchema = z.array(itemSchema).max(MAX_LINES);

export type CartItem = z.infer<typeof itemSchema>;

const EMPTY: CartItem[] = [];
let cached: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };
const listeners = new Set<() => void>();

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cached.raw) return cached.items;
    const parsed = raw ? cartSchema.safeParse(JSON.parse(raw)) : null;
    const items = parsed?.success ? parsed.data : EMPTY;
    cached = { raw, items: items.length === 0 ? EMPTY : items };
    return cached.items;
  } catch {
    // localStorage bloqueado o JSON dañado: se trata como carrito vacío.
    return EMPTY;
  }
}

function write(items: CartItem[]) {
  try {
    const raw = items.length === 0 ? null : JSON.stringify(items);
    if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
    cached = { raw, items: items.length === 0 ? EMPTY : items };
  } catch {
    // Sin almacenamiento disponible: el carrito no se puede guardar.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Cambios hechos desde otra pestaña.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Suma `cantidad` al producto sin pasar de `max` (unidades disponibles). */
export function addToCart(productId: string, cantidad: number, max: number) {
  const items = read();
  const existing = items.find((i) => i.productId === productId);
  const limit = Math.min(max, MAX_QUANTITY);
  if (existing) {
    write(
      items.map((i) =>
        i.productId === productId
          ? { ...i, cantidad: Math.min(i.cantidad + cantidad, limit) }
          : i,
      ),
    );
  } else if (items.length < MAX_LINES) {
    write([...items, { productId, cantidad: Math.min(cantidad, limit) }]);
  }
}

export function setCartQuantity(productId: string, cantidad: number) {
  const clamped = Math.min(Math.max(Math.trunc(cantidad), 1), MAX_QUANTITY);
  write(read().map((i) => (i.productId === productId ? { ...i, cantidad: clamped } : i)));
}

export function removeFromCart(productId: string) {
  write(read().filter((i) => i.productId !== productId));
}

export function clearCart() {
  write([]);
}
