// C. LÓGICA DE NEGOCIO Y CONCURRENCIA, con sesiones reales de cliente 1 y 2 y productos/descuentos de prueba (zz-sec-).
// Todo ataque debe fallar. Los pedidos de prueba se hacen vencer al terminar (vía normal: liberan la reserva).
// Límite honesto: con DOS cuentas de prueba, la concurrencia entre "muchos compradores" se hace con 2 carritos y
// muchas peticiones simultáneas por cuenta; el máximo de 3 pendientes se prueba por rondas.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  NO_ACCOUNTS, PREFIX, ZERO, appUp, assertDevOnly, callAction, check, clearTestCart, createOrderRpc, ensureCategory, ensureProduct, expirePending,
  haveService, installSummary, orderRow, productRow, rec, rest, setCart, svc, trySession, uploadFixtureProof, CHECKOUT_OK, JPEG_BYTES,
} from "./lib.mjs";

installSummary("C. Lógica de negocio y concurrencia");
const c1 = await trySession("c1");
const c2 = await trySession("c2");
const up = await appUp();
const skip = (!c1 || !c2 || !haveService) && (NO_ACCOUNTS + (haveService ? "" : " / falta service_role"));
const appSkip = skip || (!up && "no hay servidor local");
if (!skip) assertDevOnly();
const run = Date.now().toString(36);
const P = {};
const limited = (r) => /Demasiados intentos/.test(r.value?.error ?? "");

async function mk(suffix, o) {
  const id = await ensureProduct(suffix, { nombre: `${PREFIX}${suffix}`, ...o });
  return { id, nombre: `${PREFIX}${suffix}`, precio: o.precio ?? 10 };
}
before(async () => {
  if (skip) return;
  await expirePending([c1.userId, c2.userId]);
  await clearTestCart(c1.userId);
  await clearTestCart(c2.userId);
  P.stock3 = await mk("c-stock3", { precio: 10, stock: 3 });
  P.big = await mk("c-big", { precio: 12.34, stock: 50 });
  P.off = await mk("c-inactivo", { precio: 10, stock: 5, activo: false });
  P.disc = await mk("c-descuento", { precio: 20, stock: 200 });
  const parentOff = await ensureCategory(`${PREFIX}cat-inactiva`, `${PREFIX}cat inactiva`, null, false);
  const subOff = await ensureCategory(`${PREFIX}sub-de-inactiva`, `${PREFIX}sub de inactiva`, parentOff, true);
  P.inCatOff = await mk("c-en-categoria-inactiva", { precio: 10, stock: 5, categoryId: subOff });
  P.settings = (await svc("GET", "/rest/v1/store_settings?select=*")).json?.[0];
});

after(async () => {
  if (skip) return;
  await expirePending([c1.userId, c2.userId]);
  await clearTestCart(c1.userId);
  await clearTestCart(c2.userId);
  // Los descuentos de prueba se desactivan (no se borran): el SQL de limpieza los elimina por su prefijo.
  await svc("PATCH", `/rest/v1/discounts?nombre=like.${PREFIX}*`, { activo: false });
});

const cartOf = async (userId) => (await svc("GET", `/rest/v1/cart_items?user_id=eq.${userId}&select=product_id,cantidad,products!inner(slug)&products.slug=like.${PREFIX}*`)).json ?? [];
const asC1 = (method, path, body) => rest(method, path, { token: c1.token, body, headers: { Prefer: "return=representation" } });

describe("C8. cantidades hostiles en el carrito", { skip: appSkip }, () => {
  const BAD = [-1, 0, 1.5, "3", 1e9, 100, 99999999999999, null, "abc", { $gt: 0 }, [1], true, "1; DROP TABLE cart_items", -0, 0.0001, "", "０１"];
  test("agregarLinea: ninguna cantidad inválida cambia el carrito", async () => {
    await clearTestCart(c1.userId);
    for (const q of BAD) {
      const r = await callAction("agregarLinea", [c1.userId, P.big.id, q], { cookie: c1.cookie });
      const cart = await cartOf(c1.userId);
      check(assert, "C8", `agregarLinea cantidad=${JSON.stringify(q)}`, "rechazada, carrito vacío", `${r.value?.ok ? "ACEPTADA" : "rechazada"}; líneas=${cart.length}`, r.value?.ok !== true && cart.length === 0);
    }
    const good = await callAction("agregarLinea", [c1.userId, P.big.id, 2], { cookie: c1.cookie });
    check(assert, "C8", "control positivo: agregarLinea(2)", "ok y 2 unidades", `${good.value?.ok} / ${(await cartOf(c1.userId))[0]?.cantidad}`, good.value?.ok === true && (await cartOf(c1.userId))[0]?.cantidad === 2);
  });
  test("fijarCantidad: negativos, cero, decimales y enormes", async () => {
    for (const q of BAD) {
      const r = await callAction("fijarCantidad", [c1.userId, P.big.id, q], { cookie: c1.cookie });
      const cart = await cartOf(c1.userId);
      check(assert, "C8", `fijarCantidad cantidad=${JSON.stringify(q)}`, "rechazada, sigue en 2", `${r.value?.ok ? "ACEPTADA" : "rechazada"}; cantidad=${cart[0]?.cantidad}`, r.value?.ok !== true && cart[0]?.cantidad === 2);
    }
  });
  test("ids de producto hostiles", async () => {
    for (const id of ["", "x", ZERO, "00000000-0000-0000-0000-00000000000g", null, 5, ["a"], { id: 1 }, "' OR 1=1--", P.big.id + "0"]) {
      const r = await callAction("agregarLinea", [c1.userId, id, 1], { cookie: c1.cookie });
      const cart = await cartOf(c1.userId);
      check(assert, "C8", `agregarLinea productId=${JSON.stringify(id)?.slice(0, 30)}`, "rechazada, nada nuevo", `${r.value?.ok ? "ACEPTADA" : "rechazada"}; líneas=${cart.length}`, cart.length === 1 && cart[0].product_id === P.big.id);
    }
  });
  test("fusionarCarrito con listas hostiles", async () => {
    const huge = Array.from({ length: 5000 }, () => ({ productId: P.big.id, cantidad: 1 }));
    for (const [label, local] of [
      ["cantidad negativa", [{ productId: P.big.id, cantidad: -5 }]],
      ["cantidad enorme", [{ productId: P.big.id, cantidad: 1e12 }]],
      ["decimales", [{ productId: P.big.id, cantidad: 2.5 }]],
      ["5000 líneas", huge],
      ["no es un arreglo", { productId: P.big.id, cantidad: 1 }],
      ["producto inexistente", [{ productId: ZERO, cantidad: 1 }]],
    ]) {
      const r = await callAction("fusionarCarrito", [c1.userId, local], { cookie: c1.cookie });
      const cart = await cartOf(c1.userId);
      const n = cart.reduce((s, l) => s + l.cantidad, 0);
      check(assert, "C8", `fusionarCarrito ${label}`, "sin pasar de 99 por línea ni del stock", `${r.value?.ok ? "ok" : "rechazada"}; unidades=${n}`, n <= 99 && cart.length <= 50);
    }
  });
  test("a nivel de base de datos: la restricción de la tabla rechaza 0, negativos, decimales y más de 99", async () => {
    for (const q of [0, -1, 100, 1.5, 1e9, "x", null]) {
      const r = await asC1("POST", "/rest/v1/cart_items", { user_id: c1.userId, product_id: P.stock3.id, cantidad: q });
      check(assert, "C8", `REST cart_items cantidad=${JSON.stringify(q)}`, "rechazada", r.status, r.status >= 400);
    }
  });
});

describe("C8/C9. el checkout rechaza entradas hostiles y recalcula todo en el servidor", { skip: appSkip }, () => {
  test("campos con tipos o largos hostiles", async () => {
    await setCart(c1.userId, [{ productId: P.big.id, cantidad: 1 }]);
    const before = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&select=id`)).json?.length;
    const bad = [
      ["nombre vacío", { nombre: "" }], ["nombre arreglo", { nombre: ["a", "b"] }], ["nombre null", { nombre: null }], ["nombre 10 000 caracteres", { nombre: "n".repeat(10000) }],
      ["teléfono con letras", { telefono: "abc" }], ["teléfono enorme", { telefono: "9".repeat(5000) }], ["teléfono objeto", { telefono: { $ne: "" } }],
      ["acepta = 'true'", { acepta: "true" }], ["acepta = 1", { acepta: 1 }], ["acepta = false", { acepta: false }], ["acepta ausente", { acepta: undefined }],
      ["addressId y address a la vez", { addressId: ZERO }], ["addressId mal formado", { addressId: "x", address: undefined }],
      ["dirección con provincia inventada", { address: { ...CHECKOUT_OK.address, provincia: "Narnia" } }],
      ["dirección de 100 000 caracteres", { address: { ...CHECKOUT_OK.address, direccion: "d".repeat(100000) } }],
      ["dirección con campo extra", { address: { ...CHECKOUT_OK.address, user_id: c2.userId } }],
    ];
    for (const [label, over] of bad) {
      const r = await callAction("crearPedido", [{ ...CHECKOUT_OK, ...over }], { cookie: c1.cookie });
      check(assert, "C8", `crearPedido ${label}`, "rechazado", `${r.value?.ok ? "CREADO" : (r.value?.error ?? "?").slice(0, 40)}`, r.value?.ok !== true);
    }
    for (const body of [null, "texto", 5, [], [[]], {}]) {
      const r = await callAction("crearPedido", [body], { cookie: c1.cookie });
      check(assert, "C8", `crearPedido con ${JSON.stringify(body)}`, "rechazado", `${r.value?.ok ? "CREADO" : "rechazado"}`, r.value?.ok !== true);
    }
    const after = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&select=id`)).json?.length;
    check(assert, "C8", "no se creó ningún pedido con entradas hostiles", "sin cambios", `${before}→${after}`, after === before);
  });

  test("C9. el pedido usa el precio de la base y lo congela; ningún campo del navegador lo cambia", async () => {
    await expirePending([c1.userId]);
    await setCart(c1.userId, [{ productId: P.big.id, cantidad: 2 }]);
    const r = await callAction("crearPedido", [CHECKOUT_OK], { cookie: c1.cookie });
    if (limited(r)) return rec("C9", "crearPedido", "pedido creado", "bloqueado por el límite de pedidos (10 por hora)", "bloqueado");
    assert.ok(r.value?.ok, `no se pudo crear el pedido: ${JSON.stringify(r.value)}`);
    const order = (await svc("GET", `/rest/v1/orders?referencia=eq.${r.value.referencia}&select=*,order_items(*)`)).json[0];
    const s = P.settings;
    const subtotal = 2 * 12.34;
    const free = s.envio_gratis_desde !== null && subtotal >= Number(s.envio_gratis_desde);
    const envio = s.costo_envio === null ? 0 : free ? 0 : Number(s.costo_envio);
    const transf = Math.round(subtotal * (Number(s.descuento_transferencia_pct ?? 0) / 100) * 100) / 100;
    check(assert, "C9", "subtotal calculado por el servidor", String(subtotal.toFixed(2)), order.subtotal, Number(order.subtotal) === Number(subtotal.toFixed(2)));
    check(assert, "C9", "envío = el de Configuración", String(envio), order.envio, Number(order.envio) === envio);
    check(assert, "C9", "total coherente y calculado en el servidor", "subtotal − descuentos + envío", order.total, Math.abs(Number(order.total) - (Number(order.subtotal) - Number(order.descuento) - Number(order.descuento_transferencia) + Number(order.envio))) < 0.005);
    check(assert, "C9", "descuento por transferencia = el de Configuración", String(transf), order.descuento_transferencia, Math.abs(Number(order.descuento_transferencia) - transf) < 0.011);
    check(assert, "C9", "línea con el nombre y precio de la base", "zz-sec-c-big × 2 a 12.34", `${order.order_items[0].nombre} ×${order.order_items[0].cantidad} a ${order.order_items[0].precio_unitario}`, order.order_items[0].nombre === P.big.nombre && Number(order.order_items[0].precio_unitario) === 12.34);
    check(assert, "C9", "el pedido guarda user_id de la sesión", "cliente 1", order.user_id === c1.userId ? "cliente 1" : order.user_id, order.user_id === c1.userId);
    check(assert, "C9", "el pedido no trae cupón", "null", order.cupon, order.cupon === null);
    // El precio se congela: si la base cambia después, el pedido no.
    await svc("PATCH", `/rest/v1/products?id=eq.${P.big.id}`, { precio: 99 });
    const frozen = (await svc("GET", `/rest/v1/order_items?order_id=eq.${order.id}&select=precio_unitario`)).json[0];
    await svc("PATCH", `/rest/v1/products?id=eq.${P.big.id}`, { precio: 12.34 });
    check(assert, "C9", "precio congelado en la línea", "12.34", frozen.precio_unitario, Number(frozen.precio_unitario) === 12.34);
  });
});

describe("C10. descuentos y cupones", { skip: appSkip }, () => {
  async function discount(nombre, extra) {
    const r = await svc("POST", "/rest/v1/discounts", { nombre: `${PREFIX}${nombre}`, alcance: "producto", target_id: P.disc.id, ...extra });
    return r;
  }
  async function priceViaOrder(label) {
    await expirePending([c1.userId]);
    await setCart(c1.userId, [{ productId: P.disc.id, cantidad: 1 }]);
    const r = await callAction("crearPedido", [CHECKOUT_OK], { cookie: c1.cookie });
    if (limited(r)) {
      rec("C10", label, "pedido creado", "bloqueado por el límite de pedidos (10 por hora)", "bloqueado");
      return null;
    }
    assert.ok(r.value?.ok, `${label}: ${JSON.stringify(r.value)}`);
    const o = (await svc("GET", `/rest/v1/orders?referencia=eq.${r.value.referencia}&select=subtotal,descuento,total,envio,descuento_transferencia`)).json[0];
    return { ...o, neto: Number(o.subtotal) - Number(o.descuento) };
  }
  const deactivateAll = () => svc("PATCH", `/rest/v1/discounts?nombre=like.${PREFIX}*`, { activo: false });

  test("restricciones de la tabla: porcentaje mayor que 100, cero y negativos", async () => {
    for (const [label, extra] of [["150 %", { tipo: "porcentaje", valor: 150 }], ["0", { tipo: "porcentaje", valor: 0 }], ["-10 %", { tipo: "porcentaje", valor: -10 }], ["monto -5", { tipo: "monto_fijo", valor: -5 }]]) {
      const r = await discount(`d-${label}`, extra);
      check(assert, "C10", `crear descuento ${label}`, "rechazado por la base", r.status, r.status >= 400);
    }
    const full = await discount("d-100-prueba", { tipo: "porcentaje", valor: 100, activo: false });
    check(assert, "C10", "crear un descuento de EXACTAMENTE 100 %", "rechazado (CLAUDE.md: menor que 100)", full.status, full.status >= 400);
  });
  test("no se aplican: vencido, aún no iniciado, inactivo, con cupón, de otro producto o de otra categoría", async () => {
    await deactivateAll();
    await discount("d-vencido", { tipo: "porcentaje", valor: 90, inicia: "2020-01-01T00:00:00Z", termina: "2020-01-02T00:00:00Z" });
    await discount("d-futuro", { tipo: "porcentaje", valor: 90, inicia: "2099-01-01T00:00:00Z" });
    await discount("d-inactivo", { tipo: "porcentaje", valor: 90, activo: false });
    await discount("d-cupon", { tipo: "porcentaje", valor: 90, codigo: `ZZSEC${run.toUpperCase().slice(-5)}` });
    await svc("POST", "/rest/v1/discounts", { nombre: `${PREFIX}d-otro-producto`, tipo: "porcentaje", valor: 90, alcance: "producto", target_id: P.big.id });
    const cat = (await svc("GET", `/rest/v1/categories?select=id&parent_id=not.is.null&slug=not.like.${PREFIX}*&limit=1`)).json?.[0]?.id;
    await svc("POST", "/rest/v1/discounts", { nombre: `${PREFIX}d-otra-categoria`, tipo: "porcentaje", valor: 90, alcance: "categoria", target_id: cat });
    const o = await priceViaOrder("precio sin descuentos aplicables");
    if (!o) return;
    check(assert, "C10", "ningún descuento no aplicable cambia el precio", "neto 20.00", o.neto.toFixed(2), Math.abs(o.neto - 20) < 0.005);
  });
  test("no se acumulan: gana solo el que más rebaja", async () => {
    await deactivateAll();
    await discount("d-30", { tipo: "porcentaje", valor: 30 });
    await discount("d-50", { tipo: "porcentaje", valor: 50 });
    const o = await priceViaOrder("dos descuentos del mismo producto");
    if (!o) return;
    check(assert, "C10", "30 % + 50 % no se suman ni se encadenan", "neto 10.00 (solo el 50 %)", o.neto.toFixed(2), Math.abs(o.neto - 10) < 0.005);
  });
  test("ningún descuento deja un producto gratis (99,99 %, monto mayor que el precio)", async () => {
    await deactivateAll();
    await svc("POST", "/rest/v1/discounts", { nombre: `${PREFIX}d-9999`, tipo: "porcentaje", valor: 99.99, alcance: "producto", target_id: P.disc.id });
    let o = await priceViaOrder("descuento del 99,99 %");
    if (o) check(assert, "C10", "99,99 % no deja el producto gratis (mínimo 1 centavo)", "neto ≥ 0.01", o.neto.toFixed(2), o.neto >= 0.01 - 1e-9 && Number(o.total) > 0);
    await deactivateAll();
    await discount("d-monto-999", { tipo: "monto_fijo", valor: 999 });
    o = await priceViaOrder("monto fijo de 999");
    if (o) check(assert, "C10", "un monto fijo mayor que el precio no deja el producto gratis", "neto ≥ 0.01", o.neto.toFixed(2), o.neto >= 0.01 - 1e-9 && Number(o.total) > 0);
  });
  test("el público solo lee descuentos automáticos y vigentes; los cupones no se ven", async () => {
    await deactivateAll();
    await discount("d-cupon-oculto", { tipo: "porcentaje", valor: 10, codigo: `ZZSEC${run.toUpperCase().slice(-5)}X`, activo: true });
    const r = await rest("GET", `/rest/v1/discounts?select=nombre,codigo&nombre=like.${PREFIX}*`);
    check(assert, "C10", "anon lee cupones", "sin filas", `${r.json?.length}`, !r.json?.length);
    const r1 = await asC1("GET", `/rest/v1/discounts?select=nombre,codigo&codigo=not.is.null&nombre=like.${PREFIX}*`);
    check(assert, "C10", "cliente lee cupones", "sin filas", `${r1.json?.length}`, !r1.json?.length);
    await deactivateAll();
  });
});

describe("C11/C12. productos inactivos, categorías desactivadas y stock", { skip: appSkip }, () => {
  test("C11. un producto inactivo o de una categoría desactivada no entra al carrito ni a un pedido", async () => {
    await expirePending([c1.userId]);
    await clearTestCart(c1.userId);
    for (const p of [P.off, P.inCatOff]) {
      const r = await callAction("agregarLinea", [c1.userId, p.id, 1], { cookie: c1.cookie });
      check(assert, "C11", `agregarLinea de ${p.nombre}`, "rechazada", `${r.value?.ok ? "ACEPTADA" : (r.value?.error ?? "?")}`, r.value?.ok !== true);
      // Aunque se inserte directo en su carrito (RLS lo permite: es su carrito), el checkout lo rechaza.
      const ins = await asC1("POST", "/rest/v1/cart_items", { user_id: c1.userId, product_id: p.id, cantidad: 1 });
      const pedido = await callAction("crearPedido", [CHECKOUT_OK], { cookie: c1.cookie });
      const orders = (await svc("GET", `/rest/v1/order_items?product_id=eq.${p.id}&select=id`)).json?.length;
      check(assert, "C11", `crearPedido con ${p.nombre} en el carrito`, "rechazado, sin pedido", `${pedido.value?.ok ? "CREADO" : (pedido.value?.error ?? "?").slice(0, 50)}; insert=${ins.status}; líneas de pedido=${orders}`, pedido.value?.ok !== true && orders === 0);
      await clearTestCart(c1.userId);
      // Pedido "directo" a la función del servidor (como si alguien hubiera forjado la petición): también rechaza.
      await setCart(c1.userId, [{ productId: p.id, cantidad: 1 }]);
      const direct = await createOrderRpc(c1.userId, [{ product_id: p.id, nombre: p.nombre, precio_unitario: 10, cantidad: 1 }]);
      check(assert, "C11", `create_order directo con ${p.nombre}`, "stock_insuficiente", `${direct.status} ${(direct.json?.message ?? "").slice(0, 40)}`, direct.status >= 400);
      await clearTestCart(c1.userId);
    }
  });
  test("C12. pedir más de lo disponible: se limita o se rechaza, sin reservar de más", async () => {
    await expirePending([c1.userId]);
    await clearTestCart(c1.userId);
    await callAction("agregarLinea", [c1.userId, P.stock3.id, 50], { cookie: c1.cookie });
    const cart = await cartOf(c1.userId);
    check(assert, "C12", "agregarLinea(50) con stock 3", "tope en 3 (o rechazo)", `${cart[0]?.cantidad ?? 0}`, (cart[0]?.cantidad ?? 0) <= 3);
    // Forzado directo en el carrito: el checkout debe rechazar.
    await svc("POST", "/rest/v1/cart_items", { user_id: c1.userId, product_id: P.stock3.id, cantidad: 50 }, { Prefer: "resolution=merge-duplicates,return=representation" });
    const p = await callAction("crearPedido", [CHECKOUT_OK], { cookie: c1.cookie });
    const after = await productRow(P.stock3.id);
    check(assert, "C12", "crearPedido con 50 unidades y stock 3", "rechazado, sin reserva", `${p.value?.ok ? "CREADO" : (p.value?.error ?? "?").slice(0, 50)}; reservado=${after.stock_reservado}`, p.value?.ok !== true && after.stock_reservado === 0);
  });
  test("C12. reservar y liberar: crear un pedido aparta stock y vencer lo devuelve", async () => {
    await expirePending([c1.userId]);
    await svc("PATCH", `/rest/v1/products?id=eq.${P.stock3.id}`, { stock: 3, stock_reservado: 0 });
    await setCart(c1.userId, [{ productId: P.stock3.id, cantidad: 2 }]);
    const r = await callAction("crearPedido", [CHECKOUT_OK], { cookie: c1.cookie });
    if (limited(r)) return rec("C12", "reservar y liberar", "pedido creado", "bloqueado por el límite de pedidos (10 por hora)", "bloqueado");
    assert.ok(r.value?.ok, JSON.stringify(r.value));
    const mid = await productRow(P.stock3.id);
    check(assert, "C12", "tras el pedido", "reservado = 2", mid.stock_reservado, mid.stock_reservado === 2);
    await expirePending([c1.userId]);
    const end = await productRow(P.stock3.id);
    check(assert, "C12", "tras vencer el pedido", "reservado = 0", end.stock_reservado, end.stock_reservado === 0);
    const order = (await svc("GET", `/rest/v1/orders?referencia=eq.${r.value.referencia}&select=estado,reserva_activa`)).json[0];
    check(assert, "C12", "el pedido vencido ya no tiene reserva", "vencido / false", `${order.estado} / ${order.reserva_activa}`, order.estado === "vencido" && order.reserva_activa === false);
    // Vencer dos veces no libera dos veces
    await svc("POST", "/rest/v1/rpc/expire_orders", {});
    const twice = await productRow(P.stock3.id);
    check(assert, "C12", "vencer otra vez no libera de más", "reservado = 0 (nunca negativo)", twice.stock_reservado, twice.stock_reservado === 0);
  });
});

describe("C13. concurrencia", { skip: skip }, () => {
  const lineFor = (p, n) => [{ product_id: p.id, nombre: p.nombre, precio_unitario: p.precio, cantidad: n }];

  test("20 pedidos simultáneos (10 por cuenta) por el mismo producto con stock bajo: no se vende de más", async () => {
    for (const [round, stock, qty, expectOrders] of [[1, 3, 2, 1], [2, 4, 2, 2], [3, 1, 1, 1]]) {
      await expirePending([c1.userId, c2.userId]);
      const p = await mk(`c13-ronda${round}`, { precio: 10, stock });
      await setCart(c1.userId, [{ productId: p.id, cantidad: qty }]);
      await setCart(c2.userId, [{ productId: p.id, cantidad: qty }]);
      const calls = [];
      for (let i = 0; i < 10; i++) {
        calls.push(createOrderRpc(c1.userId, lineFor(p, qty)));
        calls.push(createOrderRpc(c2.userId, lineFor(p, qty)));
      }
      const res = await Promise.all(calls);
      const ok = res.filter((r) => r.status < 300).length;
      const row = await productRow(p.id);
      const orders = (await svc("GET", `/rest/v1/order_items?product_id=eq.${p.id}&select=cantidad,order_id`)).json ?? [];
      const units = orders.reduce((s, o) => s + o.cantidad, 0);
      check(assert, "C13", `ronda ${round}: stock ${stock}, 2 cuentas × 10 peticiones de ${qty}`, `${expectOrders} pedido(s), reservado ≤ stock, nunca negativo`, `pedidos=${ok}, reservado=${row.stock_reservado}/${row.stock}, unidades en pedidos=${units}`, ok === expectOrders && row.stock_reservado <= row.stock && row.stock_reservado >= 0 && units === row.stock_reservado);
      await expirePending([c1.userId, c2.userId]);
      const rel = await productRow(p.id);
      check(assert, "C13", `ronda ${round}: al vencer, todo vuelve a 0`, "reservado = 0", rel.stock_reservado, rel.stock_reservado === 0);
    }
  });

  test("5 pedidos simultáneos del mismo cliente con el mismo carrito: se crea UNO; y el máximo de 3 pendientes se respeta por rondas", async () => {
    await expirePending([c1.userId]);
    const p = await mk("c13-limite", { precio: 10, stock: 100 });
    let created = 0;
    let blocked = null;
    for (let round = 1; round <= 4; round++) {
      await setCart(c1.userId, [{ productId: p.id, cantidad: 1 }]);
      const res = await Promise.all(Array.from({ length: 5 }, () => createOrderRpc(c1.userId, lineFor(p, 1))));
      const ok = res.filter((r) => r.status < 300).length;
      const msgs = [...new Set(res.filter((r) => r.status >= 300).map((r) => r.json?.message))];
      if (round <= 3) {
        check(assert, "C13", `ronda ${round}: 5 simultáneos, mismo carrito`, "exactamente 1 pedido", `${ok} (otros: ${msgs.join(",")})`, ok === 1);
        created += ok;
      } else {
        blocked = { ok, msgs };
        check(assert, "C13", "ronda 4: ya hay 3 pendientes", "0 pedidos, limite_pendientes", `${ok} (${msgs.join(",")})`, ok === 0 && msgs.includes("limite_pendientes"));
      }
    }
    const pend = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&estado=eq.pendiente_pago&select=id,order_items!inner(nombre)&order_items.nombre=eq.${p.nombre}`)).json?.length;
    check(assert, "C13", "pendientes de pago del cliente 1 (pedidos de esta prueba)", "3", pend, pend === 3 && created === 3 && blocked !== null);
    const row = await productRow(p.id);
    check(assert, "C13", "stock reservado = 3 (uno por pedido)", "3", row.stock_reservado, row.stock_reservado === 3);
    await expirePending([c1.userId]);
  });

  test("dos comprobantes a la vez en el mismo pedido: queda un solo comprobante vigente", async () => {
    await expirePending([c1.userId]);
    const p = await mk("c13-comprobantes", { precio: 10, stock: 20 });
    await setCart(c1.userId, [{ productId: p.id, cantidad: 1 }]);
    const o = (await createOrderRpc(c1.userId, lineFor(p, 1))).json[0];
    const mkProof = async (i) => {
      const path = `${c1.userId}/${o.o_id}/${PREFIX}c13-${run}-${i}.jpg`;
      await uploadFixtureProof(path, Buffer.concat([JPEG_BYTES, Buffer.from(String(i))]));
      return svc("POST", "/rest/v1/rpc/submit_payment_proof", { p_user_id: c1.userId, p_order_id: o.o_id, p_archivo: path, p_hash: (`${i}`.repeat(64)).slice(0, 64).replace(/[^0-9a-f]/g, "a") });
    };
    const res = await Promise.all([mkProof("a1"), mkProof("b2"), mkProof("c3"), mkProof("d4")]);
    const proofs = (await svc("GET", `/rest/v1/payment_proofs?order_id=eq.${o.o_id}&select=id,estado`)).json ?? [];
    const active = proofs.filter((x) => x.estado === "en_revision" || x.estado === "aprobado").length;
    const order = await orderRow(o.o_id);
    check(assert, "C13", "4 comprobantes simultáneos", "1 vigente, máximo 3 en total, pedido en comprobante_recibido", `vigentes=${active}, total=${proofs.length}, estado=${order.estado}, respuestas=${res.map((r) => r.status).join(",")}`, active === 1 && proofs.length <= 3 && order.estado === "comprobante_recibido");
  });

  test("dos comprobantes a la vez por la app (multipart)", { skip: appSkip }, async () => {
    await expirePending([c2.userId]);
    const p = await mk("c13-app-comprobantes", { precio: 10, stock: 20 });
    await setCart(c2.userId, [{ productId: p.id, cantidad: 1 }]);
    const o = (await createOrderRpc(c2.userId, lineFor(p, 1))).json[0];
    const fileFor = (n) => {
      const f = new FormData();
      f.set("archivo", new File([Buffer.concat([JPEG_BYTES, Buffer.from(`app${n}${run}`)])], `x${n}.jpg`, { type: "image/jpeg" }));
      return f;
    };
    const res = await Promise.all([1, 2, 3, 4].map((n) => callAction("subirComprobante", [o.o_referencia, fileFor(n)], { cookie: c2.cookie })));
    const proofs = (await svc("GET", `/rest/v1/payment_proofs?order_id=eq.${o.o_id}&select=id,estado`)).json ?? [];
    const active = proofs.filter((x) => x.estado === "en_revision" || x.estado === "aprobado").length;
    if (res.some((r) => limited(r))) rec("C13", "subirComprobante concurrente", "1 vigente", "bloqueado por el límite de comprobantes (10 por hora)", "bloqueado");
    check(assert, "C13", "4 subidas simultáneas por la app", "1 vigente, máximo 3 en total", `vigentes=${active}, total=${proofs.length}; ${res.map((r) => (r.value?.ok ? "ok" : (r.value?.error ?? "?").slice(0, 25))).join(" | ")}`, active <= 1 && proofs.length <= 3);
  });
});

describe("C14/C15. saltos de estado y comprobantes (lo que se puede probar sin 2FA)", { skip: skip }, () => {
  test("C14. la base rechaza pasar a pagado o comprobante_recibido sin comprobante, aunque se intente con service_role", async () => {
    await expirePending([c1.userId]);
    const p = await mk("c14", { precio: 10, stock: 20 });
    await setCart(c1.userId, [{ productId: p.id, cantidad: 1 }]);
    const o = (await createOrderRpc(c1.userId, [{ product_id: p.id, nombre: p.nombre, precio_unitario: 10, cantidad: 1 }])).json[0];
    for (const estado of ["pagado", "comprobante_recibido", "enviado", "entregado"]) {
      const r = await svc("PATCH", `/rest/v1/orders?id=eq.${o.o_id}`, { estado });
      const row = await orderRow(o.o_id);
      check(assert, "C14", `UPDATE directo pendiente_pago → ${estado}`, "rechazado por la base", `${r.status}; estado=${row.estado}`, row.estado === "pendiente_pago");
    }
  });
  test("C15. el 4.º comprobante se rechaza (máximo 3) y el pedido vencido no admite ninguno", async () => {
    await expirePending([c1.userId]);
    const p = await mk("c15", { precio: 10, stock: 20 });
    await setCart(c1.userId, [{ productId: p.id, cantidad: 1 }]);
    const o = (await createOrderRpc(c1.userId, [{ product_id: p.id, nombre: p.nombre, precio_unitario: 10, cantidad: 1 }])).json[0];
    const results = [];
    for (let i = 1; i <= 4; i++) {
      const path = `${c1.userId}/${o.o_id}/${PREFIX}c15-${run}-${i}.jpg`;
      await uploadFixtureProof(path, Buffer.concat([JPEG_BYTES, Buffer.from(`c15-${i}`)]));
      const hash = i.toString(16).repeat(64).slice(0, 64);
      results.push(await svc("POST", "/rest/v1/rpc/submit_payment_proof", { p_user_id: c1.userId, p_order_id: o.o_id, p_archivo: path, p_hash: hash }));
    }
    check(assert, "C15", "comprobantes 1, 2 y 3 aceptados; el 4.º rechazado", "ok, ok, ok, limite_comprobantes", results.map((r) => (r.status < 300 ? "ok" : r.json?.message)).join(", "), results.slice(0, 3).every((r) => r.status < 300) && results[3].status >= 400 && /limite_comprobantes/.test(results[3].json?.message ?? ""));
    // mismo archivo
    const dup = await svc("POST", "/rest/v1/rpc/submit_payment_proof", { p_user_id: c1.userId, p_order_id: o.o_id, p_archivo: `${c1.userId}/${o.o_id}/x.jpg`, p_hash: "3".repeat(64) });
    check(assert, "C15", "reemplazar con el mismo archivo", "rechazado", dup.json?.message ?? dup.status, dup.status >= 400);
    // de otro usuario
    const foreign = await svc("POST", "/rest/v1/rpc/submit_payment_proof", { p_user_id: c2.userId, p_order_id: o.o_id, p_archivo: `${c2.userId}/${o.o_id}/x.jpg`, p_hash: "9".repeat(64) });
    check(assert, "C15", "subir un comprobante a un pedido ajeno", "pedido_no_encontrado", foreign.json?.message ?? foreign.status, foreign.status >= 400 && /pedido_no_encontrado/.test(foreign.json?.message ?? ""));
    // vencido
    await svc("PATCH", `/rest/v1/orders?id=eq.${o.o_id}`, { vence_en: "2020-01-01T00:00:00Z" });
    const late = await svc("POST", "/rest/v1/rpc/submit_payment_proof", { p_user_id: c1.userId, p_order_id: o.o_id, p_archivo: `${c1.userId}/${o.o_id}/late.jpg`, p_hash: "8".repeat(64) });
    check(assert, "C15", "comprobante en un pedido con el plazo vencido", "rechazado", late.json?.message ?? late.status, late.status >= 400);
  });
  rec("C14", "aprobar sin comprobante, enviar sin pagar, entregar sin enviar, cancelar uno pagado, rechazar uno aprobado (funciones admin_*)", "rechazado por la función", "no probado aquí: exige un administrador con 2FA (aal2); cubierto por supabase/tests/rls.test.sql", "bloqueado");
  rec("C15", "reemplazar un comprobante ya aprobado y dos aprobaciones simultáneas", "rechazado / una sola gana", "no probado aquí: aprobar exige un administrador con 2FA (aal2); cubierto por supabase/tests/rls.test.sql", "bloqueado");
});
