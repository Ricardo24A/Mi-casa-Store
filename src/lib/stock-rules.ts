// Reglas del stock editable por el dueño. Puro y sin `@/`, para probarlo con node:test.
//
// `stock` = unidades físicas; `stock_reservado` = apartadas por pedidos pendientes o en revisión.
// Disponible para vender = stock - reservado. La base de datos impide `stock_reservado > stock`
// (restricción `products_reserva_valida`); esta función da el mensaje claro ANTES de llegar ahí.

export const availableStock = (stock: number, reserved: number) => Math.max(stock - reserved, 0);

export type StockCheck = { ok: true } | { ok: false; error: string; min: number };

/** El nuevo stock no puede ser menor que lo reservado por pedidos. */
export function checkStockChange(newStock: number, reserved: number): StockCheck {
  if (!Number.isInteger(newStock) || newStock < 0) {
    return { ok: false, error: "El stock debe ser un número entero de 0 o más.", min: Math.max(reserved, 0) };
  }
  if (newStock < reserved) {
    return {
      ok: false,
      min: reserved,
      error: `No puedes dejar menos de ${reserved} ${reserved === 1 ? "unidad" : "unidades"}: están reservadas por pedidos que aún no se cierran.`,
    };
  }
  return { ok: true };
}

/** ¿Poco stock? Mira lo disponible (no lo reservado). */
export const isLowStock = (stock: number, reserved: number, threshold: number) =>
  availableStock(stock, reserved) <= threshold;
