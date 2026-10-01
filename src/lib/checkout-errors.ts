/**
 * Errores de `create_order` (base de datos) traducidos para el checkout. Sin dependencias de servidor
 * para poder probarlo. `code` decide qué enlace muestra la pantalla junto al mensaje.
 */

export type CheckoutErrorCode = "stock" | "cuenta";

export interface CheckoutError {
  error: string;
  code?: CheckoutErrorCode;
}

export const CHECKOUT_GENERIC_ERROR = "No pudimos crear tu pedido. Inténtalo de nuevo en un momento.";

const ORDER_ERRORS: Record<string, CheckoutError> = {
  stock_insuficiente: {
    code: "stock",
    error: "Alguien compró antes que tú y ya no hay stock suficiente. Revisa tu carrito.",
  },
  limite_pendientes: {
    code: "cuenta",
    error:
      "Ya tienes 3 pedidos esperando pago. Sube el comprobante de alguno o espera a que venza antes de hacer otro.",
  },
  // Doble clic o dos pestañas: el primer envío ya creó el pedido y vació el carrito.
  carrito_vacio: {
    code: "cuenta",
    error: "Tu carrito ya no tiene productos. Si acabas de confirmar, tu pedido está en Mi cuenta.",
  },
  carrito_cambio: {
    code: "stock",
    error: "Tu carrito cambió mientras confirmabas (quizá en otra pestaña). Revísalo y confirma de nuevo.",
  },
};

export function checkoutErrorFromDb(message: string | undefined): CheckoutError {
  return (message && ORDER_ERRORS[message]) || { error: CHECKOUT_GENERIC_ERROR };
}
