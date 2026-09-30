// Vista previa del precio final en el formulario de descuentos. Usa LA MISMA función de precios que la
// tienda y el checkout (`priceProduct`), con los demás descuentos reales, así la vista previa muestra
// exactamente cómo se acumulan (gana el que más rebaja). Es solo informativa: el precio que se cobra
// lo calcula siempre el servidor. Sin `@/`, para probarlo con node:test.

import { localToIso, type DiscountKind, type DiscountScope } from "./discount-rules.ts";
import { priceProduct, type PricingDiscount } from "./pricing.ts";

export interface PreviewForm {
  tipo: DiscountKind;
  valor: string;
  alcance: DiscountScope;
  targetId: string;
  inicia: string;
  termina: string;
}

export interface PreviewProduct {
  id: string;
  category_id: string;
  precio: number;
}

export interface OtherDiscount extends PricingDiscount {
  id: string;
  nombre: string;
}

export type Preview =
  | { kind: "incompleto" }
  | {
      kind: "ok";
      precioLista: number;
      /** Precio final con este descuento (más los demás). */
      conEste: number;
      /** Precio final solo con los demás descuentos. */
      sinEste: number;
      /** ¿Es este el descuento que se aplica a este producto? */
      aplica: boolean;
      /** El descuento que gana cuando no es este, si hay. */
      ganador: { id: string; nombre: string } | null;
      /** Este descuento no toca al producto de ejemplo (otro producto, otra categoría). */
      fueraDeAlcance: boolean;
      /** Cuándo entra en vigor / si ya venció, para avisar. */
      vigencia: "vigente" | "programado" | "vencido";
    };

const MINE = "__este__";

export function previewPrice(input: {
  form: PreviewForm;
  product: PreviewProduct;
  others: readonly OtherDiscount[];
  parents: Readonly<Record<string, string | null>>;
  now: Date;
}): Preview {
  const { form, product, others, parents, now } = input;

  const valor = Number(form.valor.replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return { kind: "incompleto" };
  if (form.tipo === "porcentaje" && valor >= 100) return { kind: "incompleto" };
  if (form.alcance !== "tienda" && !form.targetId) return { kind: "incompleto" };

  const startIso = form.inicia ? localToIso(form.inicia) : null;
  const endIso = form.termina ? localToIso(form.termina) : null;
  if ((form.inicia && !startIso) || (form.termina && !endIso)) return { kind: "incompleto" };

  const start = startIso ? new Date(startIso) : now;
  const end = endIso ? new Date(endIso) : null;
  const vigencia: "vigente" | "programado" | "vencido" =
    start.getTime() > now.getTime() ? "programado" : end && end.getTime() <= now.getTime() ? "vencido" : "vigente";

  // Se calcula "como si estuviera vigente": en su primer instante si aún no empieza o ya venció.
  const at = vigencia === "vigente" ? now : new Date(start.getTime() + 1000);

  const mine: PricingDiscount = {
    id: MINE,
    tipo: form.tipo,
    valor,
    alcance: form.alcance,
    target_id: form.alcance === "tienda" ? null : form.targetId,
    codigo: null,
    inicia: start.toISOString(),
    termina: endIso,
    activo: true,
  };

  const ctx = { now: at, parents };
  const sinEste = priceProduct(product, others, ctx);
  const conEste = priceProduct(product, [...others, mine], ctx);
  const aplica = conEste.discountId === MINE;
  const winner = !aplica && conEste.discountId ? others.find((o) => o.id === conEste.discountId) : undefined;

  // ¿Toca al producto? Se prueba con este descuento solo.
  const solo = priceProduct(product, [mine], ctx);

  return {
    kind: "ok",
    precioLista: conEste.precioLista,
    conEste: conEste.precioFinal,
    sinEste: sinEste.precioFinal,
    aplica,
    ganador: winner ? { id: winner.id, nombre: winner.nombre } : null,
    fueraDeAlcance: solo.discountId !== MINE,
    vigencia,
  };
}
