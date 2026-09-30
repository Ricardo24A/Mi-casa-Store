import assert from "node:assert/strict";
import { test } from "node:test";
import { createCartStore, type CartApi, type CartApiResult, type CartStorage } from "./cart-core.ts";
import { mergeCartLines, type CartItem } from "./cart-logic.ts";

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const P1 = id(1);
const P2 = id(2);
const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LUIS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KEY = "mcs-cart-v1";

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: CartStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  return { storage, data };
}

/** "Servidor" en memoria: un carrito por cuenta. `session` es la cuenta con sesión. */
function fakeServer(stock: Record<string, number> = { [P1]: 50, [P2]: 50 }) {
  const carts = new Map<string, CartItem[]>();
  const calls: string[] = [];
  let session: string | null = ANA;
  let failMerge = false;
  const availability = new Map(Object.entries(stock).map(([k, v]) => [k, { disponible: v }]));

  const guard = (expected: string, fn: (uid: string) => CartItem[]): CartApiResult => {
    if (!session) return { ok: false, code: "login" };
    if (session !== expected) return { ok: false, code: "session", userId: session, items: carts.get(session) ?? [] };
    const items = fn(session);
    carts.set(session, items);
    return { ok: true, userId: session, items };
  };
  const cur = (u: string) => carts.get(u) ?? [];

  const api: CartApi = {
    get: async (e) => (calls.push("get"), guard(e, cur)),
    add: async (e, p, n) => {
      calls.push("add");
      return guard(e, (u) => {
        const ex = cur(u).find((i) => i.productId === p);
        const q = Math.min((ex?.cantidad ?? 0) + n, 99, stock[p] ?? 0);
        return ex ? cur(u).map((i) => (i.productId === p ? { ...i, cantidad: q } : i)) : [...cur(u), { productId: p, cantidad: q }];
      });
    },
    set: async (e, p, n) => (calls.push("set"), guard(e, (u) => cur(u).map((i) => (i.productId === p ? { ...i, cantidad: n } : i)))),
    remove: async (e, p) => (calls.push("remove"), guard(e, (u) => cur(u).filter((i) => i.productId !== p))),
    clear: async (e) => (calls.push("clear"), guard(e, () => [])),
    merge: async (e, local) => {
      calls.push("merge");
      if (failMerge) return { ok: false, code: "error", error: "boom" };
      return guard(e, (u) => mergeCartLines(cur(u), local, availability));
    },
  };
  return {
    api,
    carts,
    calls,
    setSession: (s: string | null) => (session = s),
    failMerges: (v: boolean) => (failMerge = v),
  };
}

const line = (productId: string, cantidad: number): CartItem => ({ productId, cantidad });

test("mientras no se sabe quién es el usuario no se muestra ni se modifica nada", () => {
  const { storage } = fakeStorage({ [KEY]: JSON.stringify([line(P1, 2)]) });
  const store = createCartStore({ storage, api: fakeServer().api });
  assert.equal(store.isReady(), false);
  assert.equal(store.getSnapshot().length, 0);
  store.add(P2, 1, 10); // se ignora
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(JSON.parse(storage.getItem(KEY)!).length, 1);
});

test("invitado: el carrito vive en localStorage", () => {
  const { storage } = fakeStorage();
  const store = createCartStore({ storage, api: fakeServer().api });
  store.sync(null, []);
  store.add(P1, 2, 10);
  assert.deepEqual(store.getSnapshot(), [line(P1, 2)]);
  assert.deepEqual(JSON.parse(storage.getItem(KEY)!), [line(P1, 2)]);
});

test("al iniciar sesión, el invitado con carrito y cuenta vacía conserva su carrito y se borra la copia local", async () => {
  const { storage, data } = fakeStorage({ [KEY]: JSON.stringify([line(P1, 2)]) });
  const server = fakeServer();
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, []);
  assert.equal(store.isReady(), false, "mientras se fusiona no se muestra nada");
  await tick();
  assert.equal(store.isReady(), true);
  assert.deepEqual(store.getSnapshot(), [line(P1, 2)]);
  assert.deepEqual(server.carts.get(ANA), [line(P1, 2)]);
  assert.equal(data.has(KEY), false, "la copia local se borra");
});

test("invitado con carrito y cuenta con carrito: suma repetidos limitando por stock", async () => {
  const { storage, data } = fakeStorage({ [KEY]: JSON.stringify([line(P1, 30), line(P2, 1)]) });
  const server = fakeServer({ [P1]: 40, [P2]: 50 });
  server.carts.set(ANA, [line(P1, 25)]);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 25)]);
  await tick();
  assert.deepEqual(store.getSnapshot(), [line(P1, 40), line(P2, 1)]); // 25 + 30 = 55, tope 40
  assert.equal(data.has(KEY), false);
});

test("invitado SIN carrito y cuenta con carrito: aparece el de la cuenta, sin fusionar", async () => {
  const { storage } = fakeStorage();
  const server = fakeServer();
  server.carts.set(ANA, [line(P2, 4)]);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P2, 4)]);
  assert.equal(store.isReady(), true);
  assert.deepEqual(store.getSnapshot(), [line(P2, 4)]);
  await tick();
  assert.ok(!server.calls.includes("merge"));
});

test("si la fusión falla, la copia local no se pierde y se ve el carrito de la cuenta", async () => {
  const { storage, data } = fakeStorage({ [KEY]: JSON.stringify([line(P1, 2)]) });
  const server = fakeServer();
  server.failMerges(true);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P2, 1)]);
  await tick();
  assert.deepEqual(store.getSnapshot(), [line(P2, 1)]);
  assert.deepEqual(JSON.parse(data.get(KEY)!), [line(P1, 2)]);
});

test("cierre de sesión: limpia la vista y la copia local, pero NO borra nada del servidor", async () => {
  const { storage, data } = fakeStorage();
  const server = fakeServer();
  server.carts.set(ANA, [line(P1, 3)]);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 3)]);
  store.add(P2, 1, 10);
  await tick();

  const callsBefore = [...server.calls];
  store.signOut();
  await tick();

  assert.equal(store.getSnapshot().length, 0, "la vista queda vacía");
  assert.equal(data.has(KEY), false, "no queda copia local");
  assert.deepEqual(server.calls, callsBefore, "no se llamó al servidor al salir");
  assert.deepEqual(server.carts.get(ANA), [line(P1, 3), line(P2, 1)], "el carrito de la cuenta sigue intacto");

  // Al volver a entrar aparece el carrito de esa cuenta.
  store.sync(ANA, server.carts.get(ANA)!);
  assert.deepEqual(store.getSnapshot(), [line(P1, 3), line(P2, 1)]);
});

test("cambio de usuario en el mismo navegador: B no ve el carrito de A, y el de A se conserva", async () => {
  const { storage, data } = fakeStorage();
  const server = fakeServer();
  server.carts.set(ANA, [line(P1, 3)]);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 3)]);

  store.signOut();
  server.setSession(LUIS);
  store.sync(LUIS, []);
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(data.has(KEY), false);
  assert.deepEqual(server.carts.get(ANA), [line(P1, 3)]);
});

test("sesión de A vencida sin pulsar Salir: al cargar sin sesión no queda nada de A en el navegador", async () => {
  const { storage, data } = fakeStorage();
  const server = fakeServer();
  server.carts.set(ANA, [line(P1, 3)]);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 3)]);
  store.add(P2, 1, 10);
  await tick();

  // Nueva carga de página: el servidor ve un invitado.
  store.release();
  assert.equal(store.getSnapshot().length, 0, "al salir de la tienda no se muestra nada");
  store.sync(null, []);
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(data.has(KEY), false, "el carrito de la cuenta nunca estuvo en localStorage");
});

test("con sesión, los cambios se ven al instante y el servidor corrige (stock)", async () => {
  const { storage } = fakeStorage();
  const server = fakeServer({ [P1]: 5, [P2]: 50 });
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, []);
  store.add(P1, 5, 99); // el cliente cree que hay 99
  store.add(P1, 5, 99);
  assert.equal(store.getSnapshot()[0].cantidad, 10, "vista optimista inmediata");
  await tick();
  await store.idle();
  assert.deepEqual(store.getSnapshot(), [line(P1, 5)], "el servidor limita por stock");
  assert.deepEqual(server.carts.get(ANA), [line(P1, 5)]);
});

test("con sesión, quitar y vaciar llegan al servidor; el almacenamiento local no se usa", async () => {
  const { storage, data } = fakeStorage();
  const server = fakeServer();
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, []);
  store.add(P1, 1, 10);
  store.add(P2, 1, 10);
  await store.idle();
  store.remove(P1);
  await store.idle();
  assert.deepEqual(server.carts.get(ANA), [line(P2, 1)]);
  store.clear();
  await store.idle();
  assert.deepEqual(server.carts.get(ANA), []);
  assert.equal(data.has(KEY), false);
});

test("si otra pestaña inició sesión con otra cuenta, esta muestra la de la sesión real y no la vieja", async () => {
  const { storage } = fakeStorage();
  const server = fakeServer();
  server.carts.set(ANA, [line(P1, 3)]);
  server.carts.set(LUIS, [line(P2, 7)]);
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 3)]);

  server.setSession(LUIS); // la cookie ahora es de Luis
  store.add(P1, 1, 10);
  await store.idle();
  assert.deepEqual(store.getSnapshot(), [line(P2, 7)], "se muestra el carrito de Luis, no el de Ana");
  assert.deepEqual(server.carts.get(ANA), [line(P1, 3)], "y no se tocó el de Ana");
});

test("si la sesión desaparece en el servidor, se pasa a invitado con el carrito local", async () => {
  const { storage } = fakeStorage();
  const server = fakeServer();
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 3)]);
  server.setSession(null);
  store.add(P2, 1, 10);
  await store.idle();
  assert.equal(store.currentUserId(), null);
  assert.equal(store.getSnapshot().length, 0);
});

test("otra pestaña: un invitado relee el carrito local; con sesión se vuelve a pedir al servidor", async () => {
  const { storage } = fakeStorage();
  const server = fakeServer();
  const guest = createCartStore({ storage, api: server.api });
  guest.sync(null, []);
  storage.setItem(KEY, JSON.stringify([line(P1, 2)])); // lo escribió otra pestaña
  guest.onStorageEvent(KEY);
  assert.deepEqual(guest.getSnapshot(), [line(P1, 2)]);
  guest.onStorageEvent("otra-clave");

  const { storage: s2 } = fakeStorage();
  const logged = createCartStore({ storage: s2, api: server.api });
  server.carts.set(ANA, [line(P1, 1)]);
  logged.sync(ANA, [line(P1, 1)]);
  server.carts.set(ANA, [line(P1, 1), line(P2, 2)]); // cambió desde otro dispositivo
  logged.onStorageEvent("mcs-cart-ping");
  await logged.idle();
  assert.deepEqual(logged.getSnapshot(), [line(P1, 1), line(P2, 2)]);
});

test("tras crear un pedido la vista queda vacía", () => {
  const { storage } = fakeStorage();
  const server = fakeServer();
  const store = createCartStore({ storage, api: server.api });
  store.sync(ANA, [line(P1, 1)]);
  store.afterOrder();
  assert.equal(store.getSnapshot().length, 0);
  assert.ok(!server.calls.includes("clear"), "el servidor ya vació las líneas al crear el pedido");
});

test("el snapshot es estable entre lecturas sin cambios (requisito de useSyncExternalStore)", () => {
  const { storage } = fakeStorage();
  const store = createCartStore({ storage, api: fakeServer().api });
  store.sync(null, []);
  store.add(P1, 1, 10);
  assert.equal(store.getSnapshot(), store.getSnapshot());
  const empty = createCartStore({ storage: fakeStorage().storage, api: fakeServer().api });
  empty.sync(null, []);
  assert.equal(empty.getSnapshot(), empty.getSnapshot());
});
