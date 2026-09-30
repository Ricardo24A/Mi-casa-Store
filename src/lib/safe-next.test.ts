import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("acepta rutas internas de la cuenta y de la compra", () => {
  assert.equal(safeNext("/cuenta/pedidos"), "/cuenta/pedidos");
  assert.equal(safeNext("/checkout"), "/checkout");
  assert.equal(safeNext("/carrito"), "/carrito");
});

test("rechaza destinos externos, protocolos y el dashboard", () => {
  for (const bad of [
    "https://malo.com",
    "//malo.com",
    "/\\malo.com",
    "/admin",
    "/admin/productos",
    "/cuenta/../admin",
    "javascript:alert(1)",
    "/cuentaXYZ",
    "",
    undefined,
    null,
    42,
  ]) {
    assert.equal(safeNext(bad), "/", String(bad));
  }
});

test("usa el destino de respaldo indicado", () => {
  assert.equal(safeNext("https://malo.com", "/carrito"), "/carrito");
});
