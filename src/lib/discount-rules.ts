// Utilidades puras de los descuentos del dashboard (sin `@/`, para probarlas con node:test).
// El cálculo del precio vive en `pricing.ts` (una sola función para tienda, checkout y vista previa).

export type DiscountKind = "porcentaje" | "monto_fijo";
export type DiscountScope = "tienda" | "categoria" | "producto";
export type DiscountStatus = "inactivo" | "programado" | "vigente" | "vencido";

export const SCOPE_LABEL: Record<DiscountScope, string> = {
  tienda: "Toda la tienda",
  categoria: "Una categoría",
  producto: "Un producto",
};

/**
 * Reglas de acumulación, en una sola frase por regla (se muestran en el dashboard):
 */
export const DISCOUNT_RULES = [
  "Los descuentos de productos no se suman: a cada producto se le aplica solo el que más rebaja.",
  "Un monto fijo se descuenta por unidad. Ningún descuento deja un producto gratis: queda al menos 1 centavo.",
  "El descuento por transferencia de Configuración, si está activo, se aplica además sobre el precio ya rebajado.",
  "Los precios los calcula siempre el servidor con los descuentos vigentes al momento de ver o comprar.",
] as const;

export function discountStatus(
  d: { activo: boolean; inicia: string; termina: string | null },
  now: Date,
): DiscountStatus {
  if (!d.activo) return "inactivo";
  if (new Date(d.inicia).getTime() > now.getTime()) return "programado";
  if (d.termina && new Date(d.termina).getTime() <= now.getTime()) return "vencido";
  return "vigente";
}

const usd = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

/** "15 %" o "$5,00 por unidad". */
export function discountValueLabel(tipo: DiscountKind, valor: number): string {
  return tipo === "porcentaje" ? `${String(valor).replace(".", ",")} %` : `${usd.format(valor)} por unidad`;
}

// ---------------------------------------------------------------------------
// Fechas: el dueño las escribe en hora de Ecuador continental (UTC-5, sin horario de verano).
// ---------------------------------------------------------------------------
const OFFSET_HOURS = 5;
const LOCAL_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "2026-10-05T14:30" (hora de Ecuador) -> instante ISO en UTC. null si no es válida. */
export function localToIso(local: string): string | null {
  if (!LOCAL_FORMAT.test(local)) return null;
  const date = new Date(`${local}:00-0${OFFSET_HOURS}:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Instante ISO -> "2026-10-05T14:30" en hora de Ecuador, para un campo datetime-local. */
export function isoToLocal(iso: string): string {
  return new Date(new Date(iso).getTime() - OFFSET_HOURS * 3_600_000).toISOString().slice(0, 16);
}
