import { fromCents, toCents } from "./pricing.ts";

export interface TotalsLine {
  /** Precio de lista por unidad. */
  precio: number;
  /** Precio por unidad con el descuento automático de la tienda. */
  precioFinal: number;
  cantidad: number;
}

export interface TotalsSettings {
  costo_envio: number;
  /** null = sin envío gratis. */
  envio_gratis_desde: number | null;
  /** 0 = sin descuento por transferencia. */
  descuento_transferencia_pct: number;
}

export interface OrderTotals {
  subtotal: number;
  descuento: number;
  descuento_transferencia: number;
  envio: number;
  total: number;
}

/**
 * Totales de un pedido, en centavos enteros. Es la ÚNICA cuenta del cobro: el checkout la usa
 * en el servidor para crear el pedido y en pantalla para mostrar el resumen, así nunca difieren.
 * Cumple la regla de la base de datos: total = subtotal - descuento - descuento_transferencia + envío.
 *
 * - subtotal: precios de lista.
 * - descuento: rebaja de los descuentos de producto (lista menos precio final).
 * - descuento_transferencia: % sobre lo que queda tras el descuento, redondeado al centavo.
 * - envío: gratis si hay umbral y lo que se paga por los productos lo alcanza.
 */
export function computeOrderTotals(lines: readonly TotalsLine[], settings: TotalsSettings): OrderTotals {
  let listCents = 0;
  let finalCents = 0;
  for (const line of lines) {
    listCents += toCents(line.precio) * line.cantidad;
    finalCents += toCents(line.precioFinal) * line.cantidad;
  }
  const discountCents = listCents - finalCents;
  const transferCents = Math.round((finalCents * settings.descuento_transferencia_pct) / 100);
  const freeShipping =
    settings.envio_gratis_desde !== null && finalCents >= toCents(settings.envio_gratis_desde);
  const shippingCents = freeShipping ? 0 : toCents(settings.costo_envio);

  return {
    subtotal: fromCents(listCents),
    descuento: fromCents(discountCents),
    descuento_transferencia: fromCents(transferCents),
    envio: fromCents(shippingCents),
    total: fromCents(finalCents - transferCents + shippingCents),
  };
}
