import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blocksCheckout, cartLineStatus, lineNotice } from "./cart-status.ts";

test("un producto que no llega de la lectura pública es no disponible (desactivado, categoría desactivada o eliminado)", () => {
  const status = cartLineStatus(2, undefined);
  assert.deepEqual(status, { kind: "no_disponible" });
  assert.deepEqual(cartLineStatus(2, null), { kind: "no_disponible" });
  assert.equal(blocksCheckout(status), true);
  assert.match(lineNotice(status) ?? "", /ya no está disponible/);
});

test("agotado y cantidad mayor que el stock también bloquean el checkout", () => {
  assert.deepEqual(cartLineStatus(1, { disponible: 0 }), { kind: "agotado" });
  assert.deepEqual(cartLineStatus(5, { disponible: 3 }), { kind: "excede", disponible: 3 });
  assert.equal(blocksCheckout(cartLineStatus(1, { disponible: 0 })), true);
  assert.equal(blocksCheckout(cartLineStatus(5, { disponible: 3 })), true);
  assert.match(lineNotice({ kind: "excede", disponible: 3 }) ?? "", /Solo quedan 3/);
});

test("una línea dentro del stock pasa y no muestra aviso", () => {
  const status = cartLineStatus(3, { disponible: 3 });
  assert.deepEqual(status, { kind: "ok" });
  assert.equal(blocksCheckout(status), false);
  assert.equal(lineNotice(status), null);
});

// ---------------------------------------------------------------------------
// El carrito y el checkout deben leer los productos SIN la clave de servidor. Con service_role se
// saltan RLS y un producto de una categoría desactivada volvería a aparecer como vendible. Estas
// pruebas fallan si alguien cambia esas lecturas por el cliente de servicio.
// ---------------------------------------------------------------------------
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("getProductsByIds lee con el cliente público (RLS), no con el de servicio", () => {
  const source = read("./catalog.ts");
  const start = source.indexOf("export async function getProductsByIds");
  assert.ok(start > 0, "existe getProductsByIds");
  const body = source.slice(start);
  assert.match(body, /createPublicClient\(\)/);
  assert.doesNotMatch(body, /createAdminClient/);
  assert.doesNotMatch(source, /supabase\/admin/);
});

test("crearPedido y el carrito toman los productos de getProductsByIds, no del cliente de servicio", () => {
  for (const file of ["../app/(tienda)/checkout/actions.ts", "../app/(tienda)/carrito/actions.ts"]) {
    const source = read(file);
    assert.match(source, /getProductsByIds/, file);
    // Solo se permite el cliente de servicio para ajustes (envío, plazos), nunca para leer `products`.
    const adminUses = source.match(/createAdminClient\(\)[\s\S]{0,200}/g) ?? [];
    for (const use of adminUses) assert.doesNotMatch(use, /from\("products"\)/, file);
  }
});
