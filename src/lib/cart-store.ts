"use client";

import { useSyncExternalStore } from "react";
import {
  agregarLinea,
  fijarCantidad,
  fusionarCarrito,
  obtenerCarrito,
  quitarLinea,
  vaciarCarrito,
} from "@/app/(tienda)/carrito/actions";
import { createCartStore, type CartApi, type CartStorage, type CartStore } from "@/lib/cart-core";
import { EMPTY_ITEMS, MAX_LINES, MAX_QUANTITY, type CartItem } from "@/lib/cart-logic";

/**
 * Carrito del navegador. Conecta el núcleo (`cart-core.ts`, con pruebas) con localStorage y con
 * las acciones de servidor reales.
 *  - Invitado: el carrito vive en localStorage.
 *  - Con sesión: vive en la base de datos, ligado al usuario; aquí solo hay una vista con
 *    actualización optimista. Nunca se guardan precios ni nombres.
 * Hasta que el layout de la tienda dice quién tiene la sesión (`useCartReady()` es false) no se
 * muestra ni se modifica nada: así nunca se ve, ni un instante, el carrito de otro usuario.
 */

export { MAX_LINES, MAX_QUANTITY };
export type { CartItem };

const storage: CartStorage = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
  removeItem: (k) => window.localStorage.removeItem(k),
};

const api: CartApi = {
  get: (expected) => obtenerCarrito(expected),
  add: (expected, productId, cantidad) => agregarLinea(expected, productId, cantidad),
  set: (expected, productId, cantidad) => fijarCantidad(expected, productId, cantidad),
  remove: (expected, productId) => quitarLinea(expected, productId),
  clear: (expected) => vaciarCarrito(expected),
  merge: (expected, local) => fusionarCarrito(expected, local),
};

let instance: CartStore | null = null;
let listening = false;

function store(): CartStore {
  if (!instance) instance = createCartStore({ storage, api });
  if (!listening) {
    listening = true;
    // Otras pestañas: cambios en localStorage o avisos ("ping") de que cambió el carrito de la cuenta.
    window.addEventListener("storage", (e) => instance?.onStorageEvent(e.key));
    // Al volver a esta pestaña o dispositivo, se vuelve a pedir el carrito de la cuenta.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") instance?.refresh();
    });
  }
  return instance;
}

const subscribe = (listener: () => void) => store().subscribe(listener);

export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, () => store().getSnapshot(), () => EMPTY_ITEMS);
}

/** true cuando ya se sabe de quién es el carrito y se puede mostrar. Antes, mostrar un esqueleto. */
export function useCartReady(): boolean {
  return useSyncExternalStore(subscribe, () => store().isReady(), () => false);
}

/** Usuario con sesión al que pertenece la vista actual (null = invitado o aún no se sabe). */
export const syncCartSession = (userId: string | null, serverItems: CartItem[]) => store().sync(userId, serverItems);
export const releaseCartSession = () => store().release();
export const clearCartOnSignOut = () => store().signOut();
export const resetCartAfterOrder = () => store().afterOrder();

export const addToCart = (productId: string, cantidad: number, max: number) => store().add(productId, cantidad, max);
export const setCartQuantity = (productId: string, cantidad: number) => store().setQuantity(productId, cantidad);
export const removeFromCart = (productId: string) => store().remove(productId);
export const clearCart = () => store().clear();
