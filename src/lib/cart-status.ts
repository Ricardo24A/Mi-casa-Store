// Estado de una línea del carrito frente a lo que la tienda puede vender ahora. Puro y sin `@/`,
// para probarlo con node:test. Lo usan el carrito, el checkout y `crearPedido` (en el servidor),
// así los tres deciden igual.
//
// `product` es lo que devuelve la lectura PÚBLICA (`getProductsByIds`): solo trae productos activos
// cuya categoría está activa (RLS). Un producto desactivado, de una categoría desactivada, de un padre
// desactivado o eliminado simplemente NO aparece: llega como undefined y es "no disponible".

export type LineStatus =
  | { kind: "ok" }
  /** Desactivado, de una categoría desactivada o eliminado. */
  | { kind: "no_disponible" }
  | { kind: "agotado" }
  | { kind: "excede"; disponible: number };

export function cartLineStatus(cantidad: number, product: { disponible: number } | null | undefined): LineStatus {
  if (!product) return { kind: "no_disponible" };
  if (product.disponible <= 0) return { kind: "agotado" };
  if (cantidad > product.disponible) return { kind: "excede", disponible: product.disponible };
  return { kind: "ok" };
}

/** Una línea que no está "ok" no pasa al checkout. */
export const blocksCheckout = (status: LineStatus) => status.kind !== "ok";

/** Aviso para el comprador. null si la línea está bien. */
export function lineNotice(status: LineStatus): string | null {
  switch (status.kind) {
    case "ok":
      return null;
    case "no_disponible":
      return "Este producto ya no está disponible en la tienda. Quítalo para continuar.";
    case "agotado":
      return "Agotado. Quítalo para continuar.";
    case "excede":
      return `Solo quedan ${status.disponible}. Reduce la cantidad para continuar.`;
  }
}
