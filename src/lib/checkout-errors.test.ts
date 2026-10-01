import assert from "node:assert/strict";
import { test } from "node:test";
import { CHECKOUT_GENERIC_ERROR, checkoutErrorFromDb } from "./checkout-errors.ts";

test("tope de pedidos pendientes: mensaje amable y enlace a Mi cuenta", () => {
  const r = checkoutErrorFromDb("limite_pendientes");
  assert.equal(r.code, "cuenta");
  assert.match(r.error, /3 pedidos esperando pago/);
});

test("doble envío: el carrito ya está vacío y el pedido existe", () => {
  const r = checkoutErrorFromDb("carrito_vacio");
  assert.equal(r.code, "cuenta");
  assert.match(r.error, /Mi cuenta/);
});

test("carrito cambiado o sin stock: se pide revisar el carrito", () => {
  assert.equal(checkoutErrorFromDb("carrito_cambio").code, "stock");
  assert.equal(checkoutErrorFromDb("stock_insuficiente").code, "stock");
});

test("cualquier otro error: mensaje genérico sin detalles internos", () => {
  for (const m of [undefined, "", "cuenta_requerida", 'new row violates check constraint "orders_total_check"']) {
    assert.deepEqual(checkoutErrorFromDb(m), { error: CHECKOUT_GENERIC_ERROR });
  }
});
