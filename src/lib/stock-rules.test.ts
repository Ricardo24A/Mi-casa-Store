import assert from "node:assert/strict";
import { test } from "node:test";
import { availableStock, checkStockChange, isLowStock } from "./stock-rules.ts";

test("el stock no puede bajar de lo reservado", () => {
  const r = checkStockChange(2, 5);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.min, 5);
  assert.match(r.ok === false ? r.error : "", /menos de 5 unidades/);
});

test("puede quedar igual a lo reservado, o subir", () => {
  assert.deepEqual(checkStockChange(5, 5), { ok: true });
  assert.deepEqual(checkStockChange(50, 5), { ok: true });
  assert.deepEqual(checkStockChange(0, 0), { ok: true });
});

test("singular en el mensaje y valores inválidos", () => {
  assert.match(checkStockChange(0, 1).ok === false ? (checkStockChange(0, 1) as { error: string }).error : "", /menos de 1 unidad:/);
  assert.equal(checkStockChange(-1, 0).ok, false);
  assert.equal(checkStockChange(1.5, 0).ok, false);
  assert.equal(checkStockChange(Number.NaN, 0).ok, false);
});

test("disponible y poco stock se calculan sobre lo no reservado", () => {
  assert.equal(availableStock(10, 4), 6);
  assert.equal(availableStock(3, 5), 0, "nunca negativo");
  assert.equal(isLowStock(10, 6, 5), true, "10 en total pero solo 4 disponibles");
  assert.equal(isLowStock(10, 0, 5), false);
  assert.equal(isLowStock(5, 0, 5), true, "el umbral cuenta como poco");
});
