"use client";

import { useEffect } from "react";
import { releaseCartSession, syncCartSession, type CartItem } from "@/lib/cart-store";

/** Le dice al carrito del navegador quién tiene la sesión y qué hay en su carrito (según el servidor). */
export function CartOwnerSync({ userId, items }: { userId: string | null; items: CartItem[] }) {
  useEffect(() => {
    syncCartSession(userId, items);
    return () => releaseCartSession();
    // `items` llega con la sesión: cambia solo cuando el servidor vuelve a renderizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  return null;
}
