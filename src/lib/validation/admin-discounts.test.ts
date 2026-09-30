import assert from "node:assert/strict";
import { test } from "node:test";
import { discountFormSchema } from "./admin-discounts.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const base = { nombre: "Fin de semana", tipo: "porcentaje", valor: "15", alcance: "tienda", targetId: "", inicia: "", termina: "", activo: "on" };
const parse = (over: Record<string, string | undefined> = {}) => discountFormSchema.safeParse({ ...base, ...over });
const error = (over: Record<string, string | undefined>, field: string) => {
  const r = parse(over);
  assert.equal(r.success, false, JSON.stringify(over));
  return r.success ? "" : (r.error.issues.find((i) => i.path[0] === field)?.message ?? "sin error en " + field);
};

test("un descuento válido de toda la tienda", () => {
  const r = parse();
  assert.equal(r.success, true);
  assert.deepEqual(r.success && r.data, {
    nombre: "Fin de semana", tipo: "porcentaje", valor: 15, alcance: "tienda", target_id: null, inicia: null, termina: null, activo: true,
  });
});

test("el valor acepta coma y se valida según el tipo", () => {
  assert.equal(parse({ valor: "12,5" }).success && (parse({ valor: "12,5" }) as { data: { valor: number } }).data.valor, 12.5);
  assert.match(error({ valor: "0" }, "valor"), /mayor que 0/);
  assert.match(error({ valor: "-5" }, "valor"), /mayor que 0/);
  assert.match(error({ valor: "100" }, "valor"), /menor que 100/);
  assert.match(error({ valor: "150" }, "valor"), /menor que 100/);
  assert.match(error({ valor: "abc" }, "valor"), /número válido/);
  assert.match(error({ valor: "1,234" }, "valor"), /2 decimales/);
  assert.equal(parse({ valor: "99,99" }).success, true);
  // Un monto fijo sí puede pasar de 100
  assert.equal(parse({ tipo: "monto_fijo", valor: "250" }).success, true);
  assert.match(error({ tipo: "monto_fijo", valor: "0,00" }, "valor"), /mayor que 0/);
});

test("el destino es obligatorio salvo para toda la tienda", () => {
  assert.match(error({ alcance: "categoria" }, "targetId"), /categoría/);
  assert.match(error({ alcance: "producto" }, "targetId"), /producto/);
  assert.match(error({ alcance: "tienda", targetId: ID }, "targetId"), /no lleva destino/);
  const ok = parse({ alcance: "producto", targetId: ID });
  assert.equal(ok.success && ok.data.target_id, ID);
  assert.equal(parse({ alcance: "categoria", targetId: "no-es-uuid" }).success, false);
});

test("fechas: hora de Ecuador, inicio opcional, fin posterior al inicio", () => {
  const r = parse({ inicia: "2026-10-05T00:00", termina: "2026-10-12T23:59" });
  assert.equal(r.success && r.data.inicia, "2026-10-05T05:00:00.000Z");
  assert.equal(r.success && r.data.termina, "2026-10-13T04:59:00.000Z");
  assert.match(error({ inicia: "2026-10-05T10:00", termina: "2026-10-05T10:00" }, "termina"), /posterior/);
  assert.match(error({ inicia: "2026-10-05T10:00", termina: "2026-10-04T10:00" }, "termina"), /posterior/);
  assert.match(error({ inicia: "hoy" }, "inicia"), /no válida/);
  assert.match(error({ termina: "2020-01-01T00:00" }, "termina"), /futuro/, "sin inicio, el fin ya pasado no tiene sentido");
});

test("el nombre es obligatorio y las casillas se leen", () => {
  assert.equal(parse({ nombre: "  " }).success, false);
  const off = parse({ activo: "" });
  assert.equal(off.success && off.data.activo, false);
  const missing = discountFormSchema.safeParse({ ...base, activo: undefined });
  assert.equal(missing.success && missing.data.activo, false);
});

test("nunca acepta un precio final: solo tipo y valor de la rebaja", () => {
  const r = discountFormSchema.safeParse({ ...base, precioFinal: "0.01", precio: "0.01" });
  assert.equal(r.success, true);
  assert.equal(r.success && "precioFinal" in r.data, false);
  assert.equal(r.success && "precio" in r.data, false);
});
