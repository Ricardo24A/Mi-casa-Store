import { Suspense } from "react";
import { CartOwnerSync } from "@/components/store/cart-owner-sync";
import { getSessionCart } from "@/lib/cart-server";

/**
 * Le dice al carrito del navegador quién tiene la sesión y qué hay en su carrito, según el
 * SERVIDOR. Va en un <Suspense> porque leer la sesión es una lectura de la petición (Cache
 * Components). Solo un cliente con sesión recibe líneas; el resto es invitado.
 */
async function CartOwnerFromSession() {
  const { userId, items } = await getSessionCart();
  return <CartOwnerSync userId={userId} items={items} />;
}

export function CartOwner() {
  return (
    <Suspense fallback={null}>
      <CartOwnerFromSession />
    </Suspense>
  );
}
