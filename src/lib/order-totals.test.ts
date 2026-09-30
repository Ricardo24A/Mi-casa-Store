import assert from "node:assert/strict";
import { test } from "node:test";
import { computeOrderTotals, shippingToArrange } from "./order-totals.ts";

const noExtras = { costo_envio: 0, envio_gratis_desde: null, descuento_transferencia_pct: 0 };

test("sin descuentos ni envío, el total es el subtotal", () => {
  const t = computeOrderTotals([{ precio: 10, precioFinal: 10, cantidad: 3 }], noExtras);
  assert.deepEqual(t, { subtotal: 30, descuento: 0, descuento_transferencia: 0, envio: 0, total: 30 });
});

test("el descuento de producto es lista menos precio final", () => {
  const t = computeOrderTotals([{ precio: 45.99, precioFinal: 36.79, cantidad: 2 }], noExtras);
  assert.equal(t.subtotal, 91.98);
  assert.equal(t.descuento, 18.4);
  assert.equal(t.total, 73.58);
});

test("el descuento por transferencia se aplica sobre lo que queda y se redondea al centavo", () => {
  const t = computeOrderTotals([{ precio: 33.33, precioFinal: 33.33, cantidad: 1 }], {
    ...noExtras,
    descuento_transferencia_pct: 5,
  });
  assert.equal(t.descuento_transferencia, 1.67); // 1.6665 → 1.67
  assert.equal(t.total, 31.66);
});

test("el envío se suma y es gratis al alcanzar el umbral", () => {
  const settings = { costo_envio: 4.5, envio_gratis_desde: 50, descuento_transferencia_pct: 0 };
  assert.equal(computeOrderTotals([{ precio: 20, precioFinal: 20, cantidad: 1 }], settings).envio, 4.5);
  assert.equal(computeOrderTotals([{ precio: 20, precioFinal: 20, cantidad: 1 }], settings).total, 24.5);
  assert.equal(computeOrderTotals([{ precio: 25, precioFinal: 25, cantidad: 2 }], settings).envio, 0);
});

test("el umbral de envío gratis mira lo que se paga tras el descuento de producto", () => {
  const settings = { costo_envio: 5, envio_gratis_desde: 50, descuento_transferencia_pct: 0 };
  // Lista 60, pero con descuento se paga 45: no llega al umbral.
  const t = computeOrderTotals([{ precio: 60, precioFinal: 45, cantidad: 1 }], settings);
  assert.equal(t.envio, 5);
});

test("siempre cumple la regla de la base: total = subtotal - descuento - transferencia + envío", () => {
  const lines = [
    { precio: 12.34, precioFinal: 9.87, cantidad: 3 },
    { precio: 0.99, precioFinal: 0.99, cantidad: 7 },
  ];
  const settings = { costo_envio: 3.99, envio_gratis_desde: 100, descuento_transferencia_pct: 7.5 };
  const t = computeOrderTotals(lines, settings);
  const cents = (n: number) => Math.round(n * 100);
  assert.equal(cents(t.total), cents(t.subtotal) - cents(t.descuento) - cents(t.descuento_transferencia) + cents(t.envio));
});

test("sin costo de envío definido no se suma nada y se marca como por coordinar", () => {
  const settings = { costo_envio: null, envio_gratis_desde: null, descuento_transferencia_pct: 0 };
  const t = computeOrderTotals([{ precio: 20, precioFinal: 20, cantidad: 1 }], settings);
  assert.equal(t.envio, 0);
  assert.equal(t.total, 20);
  assert.equal(shippingToArrange(settings), true);
  assert.equal(shippingToArrange({ ...settings, costo_envio: 0 }), false, "0 es envío gratis decidido a propósito");
});
