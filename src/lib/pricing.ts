/**
 * Precio con descuento. ÚNICA función de cálculo: la usan la tienda (para mostrar) y el
 * checkout en el servidor (para cobrar), así nunca difieren. Es pura (sin base de datos, sin
 * fecha implícita) y calcula en centavos enteros para evitar errores de coma flotante.
 *
 * Regla: se aplica UN solo descuento, el que más rebaje (no se acumulan).
 */

export interface PricingProduct {
  id: string;
  category_id: string;
  /** Precio de lista en USD. */
  precio: number;
}

export interface PricingDiscount {
  id?: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  alcance: "producto" | "categoria" | "tienda";
  target_id: string | null;
  /** Cupón. Un descuento con código solo aplica si el comprador lo ingresó. */
  codigo: string | null;
  inicia: string;
  termina: string | null;
  activo: boolean;
}

export interface PricingContext {
  now: Date;
  /** categoría (subcategoría) → categoría padre. Para descuentos por categoría. */
  parents: Readonly<Record<string, string | null>>;
  /** Cupón ingresado por el comprador (en el checkout). Vacío en la tienda. */
  coupon?: string | null;
}

export interface PricedProduct {
  /** Precio de lista. */
  precioLista: number;
  /** Rebaja en USD (0 si no hay descuento). */
  descuento: number;
  /** Lo que se paga por unidad. */
  precioFinal: number;
  /** Descuento aplicado, si hay. */
  discountId: string | null;
}

export const toCents = (usd: number) => Math.round(usd * 100);
export const fromCents = (cents: number) => cents / 100;

export function isDiscountActive(d: PricingDiscount, now: Date): boolean {
  if (!d.activo) return false;
  if (new Date(d.inicia).getTime() > now.getTime()) return false;
  if (d.termina && new Date(d.termina).getTime() <= now.getTime()) return false;
  return true;
}

function appliesTo(d: PricingDiscount, p: PricingProduct, ctx: PricingContext): boolean {
  if (!isDiscountActive(d, ctx.now)) return false;
  if (d.codigo) {
    if (!ctx.coupon || ctx.coupon.trim().toUpperCase() !== d.codigo.toUpperCase()) return false;
  }
  switch (d.alcance) {
    case "tienda":
      return true;
    case "producto":
      return d.target_id === p.id;
    case "categoria":
      return (
        d.target_id !== null &&
        (d.target_id === p.category_id || d.target_id === (ctx.parents[p.category_id] ?? null))
      );
  }
}

/** Rebaja en centavos que produce `d` sobre un precio de lista en centavos. */
function discountCents(d: PricingDiscount, listCents: number): number {
  const raw = d.tipo === "porcentaje" ? Math.round((listCents * d.valor) / 100) : toCents(d.valor);
  return Math.min(Math.max(raw, 0), listCents);
}

export function priceProduct(
  product: PricingProduct,
  discounts: readonly PricingDiscount[],
  ctx: PricingContext,
): PricedProduct {
  const listCents = toCents(product.precio);
  let best = 0;
  let bestId: string | null = null;

  for (const d of discounts) {
    if (!appliesTo(d, product, ctx)) continue;
    const cents = discountCents(d, listCents);
    if (cents > best) {
      best = cents;
      bestId = d.id ?? null;
    }
  }

  return {
    precioLista: fromCents(listCents),
    descuento: fromCents(best),
    precioFinal: fromCents(listCents - best),
    discountId: bestId,
  };
}
