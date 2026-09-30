import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_ITEMS,
  MAX_LINES,
  MAX_QUANTITY,
  addLine,
  mergeCartLines,
  parseGuestCart,
  removeLine,
  serializeGuestCart,
  setLine,
  type Availability,
  type CartItem,
} from "./cart-logic.ts";

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const A = id(1);
const B = id(2);
const C = id(3);

const stock = (entries: Record<string, number | null>): Availability =>
  new Map(Object.entries(entries).map(([k, v]) => [k, v === null ? null : { disponible: v }]));

test("fusión: invitado con carrito y cuenta sin carrito → queda el del invitado", () => {
  const merged = mergeCartLines([], [{ productId: A, cantidad: 2 }], stock({ [A]: 10 }));
  assert.deepEqual(merged, [{ productId: A, cantidad: 2 }]);
});

test("fusión: invitado sin carrito y cuenta con carrito → queda el de la cuenta", () => {
  const server: CartItem[] = [{ productId: A, cantidad: 3 }];
  assert.deepEqual(mergeCartLines(server, [], stock({ [A]: 10 })), server);
});

test("fusión: los repetidos suman sus cantidades", () => {
  const merged = mergeCartLines(
    [{ productId: A, cantidad: 2 }, { productId: B, cantidad: 1 }],
    [{ productId: A, cantidad: 3 }, { productId: C, cantidad: 4 }],
    stock({ [A]: 20, [B]: 20, [C]: 20 }),
  );
  assert.deepEqual(merged, [
    { productId: A, cantidad: 5 },
    { productId: B, cantidad: 1 },
    { productId: C, cantidad: 4 },
  ]);
});

test("fusión: el tope de stock limita la suma", () => {
  const merged = mergeCartLines([{ productId: A, cantidad: 4 }], [{ productId: A, cantidad: 5 }], stock({ [A]: 6 }));
  assert.deepEqual(merged, [{ productId: A, cantidad: 6 }]);
});

test("fusión: el máximo por línea limita la suma aunque haya stock", () => {
  const merged = mergeCartLines([{ productId: A, cantidad: 80 }], [{ productId: A, cantidad: 60 }], stock({ [A]: 500 }));
  assert.deepEqual(merged, [{ productId: A, cantidad: MAX_QUANTITY }]);
});

test("fusión: un producto agotado conserva lo de la cuenta y no recibe lo del invitado", () => {
  const merged = mergeCartLines(
    [{ productId: A, cantidad: 2 }],
    [{ productId: A, cantidad: 3 }, { productId: B, cantidad: 1 }],
    stock({ [A]: 0, [B]: 0 }),
  );
  // A sigue con lo que ya tenía la cuenta (se mostrará con aviso); B, solo del invitado, se descarta.
  assert.deepEqual(merged, [{ productId: A, cantidad: 2 }]);
});

test("fusión: un producto inactivo o inexistente no recibe nada del invitado", () => {
  const merged = mergeCartLines(
    [{ productId: A, cantidad: 2 }],
    [{ productId: A, cantidad: 1 }, { productId: B, cantidad: 1 }],
    stock({ [A]: null }), // A inactivo; B ni siquiera figura
  );
  assert.deepEqual(merged, [{ productId: A, cantidad: 2 }]);
});

test("fusión: máximo de líneas, primero las de la cuenta", () => {
  const server = Array.from({ length: 40 }, (_, i) => ({ productId: id(100 + i), cantidad: 1 }));
  const local = Array.from({ length: 30 }, (_, i) => ({ productId: id(200 + i), cantidad: 1 }));
  const all = stock(Object.fromEntries([...server, ...local].map((l) => [l.productId, 10])));
  const merged = mergeCartLines(server, local, all);
  assert.equal(merged.length, MAX_LINES);
  assert.deepEqual(merged.slice(0, 40), server);
});

test("fusión: nunca produce cantidades fuera de 1..99 ni duplicados", () => {
  const merged = mergeCartLines(
    [{ productId: A, cantidad: 99 }],
    [{ productId: A, cantidad: 99 }, { productId: A, cantidad: 99 }],
    stock({ [A]: 1000 }),
  );
  assert.equal(merged.length, 1);
  assert.ok(merged[0].cantidad >= 1 && merged[0].cantidad <= MAX_QUANTITY);
});

test("líneas: agregar respeta el máximo, quitar y fijar", () => {
  assert.deepEqual(addLine([], A, 2, 10), [{ productId: A, cantidad: 2 }]);
  assert.deepEqual(addLine([{ productId: A, cantidad: 9 }], A, 5, 10), [{ productId: A, cantidad: 10 }]);
  assert.deepEqual(addLine([], A, 5, 0), []);
  assert.deepEqual(setLine([{ productId: A, cantidad: 1 }], A, 500), [{ productId: A, cantidad: MAX_QUANTITY }]);
  assert.deepEqual(removeLine([{ productId: A, cantidad: 1 }, { productId: B, cantidad: 1 }], A), [{ productId: B, cantidad: 1 }]);
});

test("copia local: ida y vuelta, y lo dañado o con dueño de otro formato se descarta", () => {
  const items: CartItem[] = [{ productId: A, cantidad: 2 }];
  assert.deepEqual(parseGuestCart(serializeGuestCart(items)), items);
  assert.equal(serializeGuestCart([]), null);
  for (const bad of [
    null,
    "",
    "{no es json",
    "42",
    '{"ownerId":null,"items":[]}',
    JSON.stringify([{ productId: "no-es-uuid", cantidad: 1 }]),
    JSON.stringify([{ productId: A, cantidad: 0 }]),
    JSON.stringify([{ productId: A, cantidad: 100 }]),
  ]) {
    assert.equal(parseGuestCart(bad), EMPTY_ITEMS, String(bad));
  }
});
