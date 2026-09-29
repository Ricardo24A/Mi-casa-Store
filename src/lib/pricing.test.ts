import assert from "node:assert/strict";
import { test } from "node:test";
import { priceProduct, type PricingContext, type PricingDiscount } from "./pricing.ts";

const now = new Date("2026-10-01T12:00:00Z");
const ctx: PricingContext = { now, parents: { sub1: "cat1", sub2: "cat2" } };
const product = { id: "p1", category_id: "sub1", precio: 20 };

const base: PricingDiscount = {
  tipo: "porcentaje",
  valor: 10,
  alcance: "tienda",
  target_id: null,
  codigo: null,
  inicia: "2026-09-01T00:00:00Z",
  termina: null,
  activo: true,
};

test("sin descuentos, el precio final es el de lista", () => {
  const r = priceProduct(product, [], ctx);
  assert.deepEqual(r, { precioLista: 20, descuento: 0, precioFinal: 20, discountId: null });
});

test("porcentaje de toda la tienda", () => {
  const r = priceProduct(product, [{ ...base, id: "d1" }], ctx);
  assert.equal(r.precioFinal, 18);
  assert.equal(r.descuento, 2);
  assert.equal(r.discountId, "d1");
});

test("monto fijo", () => {
  const r = priceProduct(product, [{ ...base, tipo: "monto_fijo", valor: 5 }], ctx);
  assert.equal(r.precioFinal, 15);
});

test("el monto fijo nunca deja el precio bajo cero", () => {
  const r = priceProduct(product, [{ ...base, tipo: "monto_fijo", valor: 999 }], ctx);
  assert.equal(r.precioFinal, 0);
});

test("redondeo a centavos sin errores de coma flotante", () => {
  // 12.99 con 15% = 1.9485 → 1.95 → 11.04
  const r = priceProduct({ ...product, precio: 12.99 }, [{ ...base, valor: 15 }], ctx);
  assert.equal(r.descuento, 1.95);
  assert.equal(r.precioFinal, 11.04);
  // 0.1 + 0.2 típico: 19.99 con 10% = 1.999 → 2.00 → 17.99
  const r2 = priceProduct({ ...product, precio: 19.99 }, [base], ctx);
  assert.equal(r2.precioFinal, 17.99);
});

test("se aplica solo el mejor descuento, no se acumulan", () => {
  const r = priceProduct(
    product,
    [
      { ...base, id: "a", valor: 10 },
      { ...base, id: "b", valor: 25 },
      { ...base, id: "c", tipo: "monto_fijo", valor: 1 },
    ],
    ctx,
  );
  assert.equal(r.precioFinal, 15);
  assert.equal(r.discountId, "b");
});

test("alcance por producto", () => {
  const d = { ...base, alcance: "producto" as const, target_id: "p1" };
  assert.equal(priceProduct(product, [d], ctx).precioFinal, 18);
  assert.equal(priceProduct({ ...product, id: "otro" }, [d], ctx).precioFinal, 20);
});

test("alcance por categoría: aplica a la subcategoría y a su categoría padre", () => {
  const sub = { ...base, alcance: "categoria" as const, target_id: "sub1" };
  const padre = { ...base, alcance: "categoria" as const, target_id: "cat1" };
  const otra = { ...base, alcance: "categoria" as const, target_id: "cat2" };
  assert.equal(priceProduct(product, [sub], ctx).precioFinal, 18);
  assert.equal(priceProduct(product, [padre], ctx).precioFinal, 18);
  assert.equal(priceProduct(product, [otra], ctx).precioFinal, 20);
});

test("un descuento con cupón solo aplica si se ingresa el cupón", () => {
  const d = { ...base, codigo: "VERANO10" };
  assert.equal(priceProduct(product, [d], ctx).precioFinal, 20);
  assert.equal(priceProduct(product, [d], { ...ctx, coupon: "otro" }).precioFinal, 20);
  assert.equal(priceProduct(product, [d], { ...ctx, coupon: " verano10 " }).precioFinal, 18);
});

test("no aplica si está inactivo, vencido o aún no empieza", () => {
  assert.equal(priceProduct(product, [{ ...base, activo: false }], ctx).precioFinal, 20);
  assert.equal(priceProduct(product, [{ ...base, termina: "2026-09-30T00:00:00Z" }], ctx).precioFinal, 20);
  assert.equal(priceProduct(product, [{ ...base, inicia: "2026-10-02T00:00:00Z" }], ctx).precioFinal, 20);
  assert.equal(priceProduct(product, [{ ...base, termina: "2026-10-02T00:00:00Z" }], ctx).precioFinal, 18);
});
