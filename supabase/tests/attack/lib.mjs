// Utilidades comunes de las pruebas de ATAQUE. Sin llaves ni contraseñas: todo sale del entorno
// (`node --env-file=.env.local`). Solo para un proyecto de DESARROLLO y un servidor local.
//
// Lo que crean las pruebas lleva el prefijo "zz-sec-" para poder limpiarlo después (ver README).

import { createServerClient } from "@supabase/ssr";
import { readdirSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { after } from "node:test";

export const PREFIX = "zz-sec-";
export const ZERO = "00000000-0000-0000-0000-000000000000";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
/** Servidor local con TURNSTILE_SECRET_KEY de PRUEBA (ver serve-test-turnstile.mjs). */
export const APP_URL = (process.env.ATTACK_APP_URL || "http://localhost:3101").replace(/\/$/, "");
/** Servidor local tal cual producción (sin clave de Turnstile). */
export const APP_STRICT_URL = (process.env.ATTACK_APP_STRICT_URL || "http://localhost:3100").replace(/\/$/, "");

export const ACCOUNTS = {
  c1: { email: process.env.ATTACK_CUSTOMER_EMAIL, password: process.env.ATTACK_CUSTOMER_PASSWORD },
  c2: { email: process.env.ATTACK_CUSTOMER2_EMAIL, password: process.env.ATTACK_CUSTOMER2_PASSWORD },
  admin: { email: process.env.ATTACK_ADMIN_NO2FA_EMAIL, password: process.env.ATTACK_ADMIN_NO2FA_PASSWORD },
};

export const haveSupabase = Boolean(SUPABASE_URL && ANON);
export const haveService = Boolean(SERVICE);
export const haveAccounts = Boolean(ACCOUNTS.c1.email && ACCOUNTS.c1.password && ACCOUNTS.c2.email && ACCOUNTS.c2.password);

// Seguro de contexto: estas pruebas ensucian datos y no deben apuntar a producción.
export function assertDevOnly() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  let host = "";
  try {
    host = new URL(site).hostname;
  } catch {
    /* sin URL */
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error("NEXT_PUBLIC_SITE_URL no es local: las pruebas de ataque solo corren contra desarrollo.");
  }
  if (process.env.ATTACK_PROD_HOST && SUPABASE_URL?.includes(process.env.ATTACK_PROD_HOST)) {
    throw new Error("El proyecto de Supabase configurado es el de producción. Abortado.");
  }
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
const rows = [];
const reportFile = process.env.ATTACK_REPORT_FILE;

/** status: "ok" (el ataque falló como debía) | "FALLÓ" (¡el ataque funcionó!) | "hallazgo" (desviación sin ataque, p. ej. de un requisito) | "bloqueado" (no se pudo probar). */
export function rec(id, intento, esperado, real, status) {
  const row = { id, intento, esperado, real: String(real).slice(0, 200), status };
  rows.push(row);
  if (reportFile) appendFileSync(reportFile, JSON.stringify(row) + "\n");
}

export function installSummary(title) {
  after(() => {
    if (rows.length === 0) return;
    console.log(`\n=== ${title}: intentos (id | intento | esperado | real | resultado) ===`);
    for (const r of rows) console.log(`${r.status === "ok" ? "OK     " : r.status === "bloqueado" ? "BLOQ   " : r.status === "hallazgo" ? "HALLAZ " : "FALLÓ  "} ${r.id} | ${r.intento} | ${r.esperado} | ${r.real}`);
    console.log(`Total: ${rows.length}, fallidos (ataque exitoso): ${rows.filter((r) => r.status === "FALLÓ").length}, hallazgos: ${rows.filter((r) => r.status === "hallazgo").length}, bloqueados: ${rows.filter((r) => r.status === "bloqueado").length}`);
  });
}

/** Aserción que además deja registro. `ok` verdadero = el sistema se defendió. */
export function check(assert, id, intento, esperado, real, ok) {
  rec(id, intento, esperado, real, ok ? "ok" : "FALLÓ");
  assert.ok(ok, `${id} ${intento}: esperado ${esperado}, real ${real}`);
}

// ---------------------------------------------------------------------------
// Supabase por REST
// ---------------------------------------------------------------------------
export async function rest(method, path, { token, body, headers = {}, key } = {}) {
  const k = key ?? ANON;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { apikey: k, Authorization: `Bearer ${token ?? k}`, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/** service_role: solo para preparar datos de prueba y verificar el resultado. Nunca como "ataque".
 *  Un permiso denegado (42501) lanza: una verificación que no pudo leer NO puede contar como "no hay nada". */
export async function svc(method, path, body, headers = {}) {
  const r = await rest(method, path, { key: SERVICE, body, headers: { Prefer: "return=representation", ...headers } });
  if (r.json && typeof r.json === "object" && r.json.code === "42501") throw new Error(`service_role sin permiso en ${path.split("?")[0]} (42501)`);
  return r;
}

/** ¿Llegaron filas? */
export const gotRows = (r) => r.status < 300 && Array.isArray(r.json) && r.json.length > 0;
/** Un intento de escritura: rechazado o sin filas afectadas. */
export const writeDenied = (r) => !gotRows(r) && (r.status >= 400 || r.json === null || (Array.isArray(r.json) && r.json.length === 0));

// ---------------------------------------------------------------------------
// Sesiones reales (las mismas cookies que deja la app)
// ---------------------------------------------------------------------------
const sessionCache = new Map();

export async function sessionFor(who) {
  if (sessionCache.has(who)) return sessionCache.get(who);
  const acc = ACCOUNTS[who];
  if (!acc?.email || !acc?.password) throw new Error(`Faltan las credenciales de ${who} en .env.local`);
  const jar = new Map();
  const sb = createServerClient(SUPABASE_URL, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email: acc.email, password: acc.password });
  if (error || !data.session) throw new Error(`No se pudo iniciar sesión como ${who}: ${error?.message ?? "sin sesión"}`);
  const s = {
    who,
    userId: data.user.id,
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    cookieNames: [...jar.keys()],
    email: acc.email,
  };
  sessionCache.set(who, s);
  return s;
}

// ---------------------------------------------------------------------------
// Acciones del servidor de la app (HTTP real contra `next start`)
// ---------------------------------------------------------------------------
/** Una IP de documentación (RFC 3849) distinta en cada ejecución: así las pruebas no gastan el contador de 127.0.0.1. */
const hex4 = () => Math.floor(Math.random() * 0x10000).toString(16);
export const randomIp = () => `2001:db8:${hex4()}:${hex4()}::${hex4()}`;
export const RUN_IP = randomIp();

let actionIds = null;
let pageOfAction = null;

/** Lee del build los ID de las acciones (cambian en cada compilación) y la página que las incluye. */
function loadActions() {
  if (actionIds) return;
  actionIds = new Map();
  const dir = ".next/static/chunks";
  if (!existsSync(dir)) throw new Error("Falta .next: corre `npm run build` primero.");
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    const src = readFileSync(`${dir}/${f}`, "utf8");
    for (const m of src.matchAll(/"([0-9a-f]{42})",[a-zA-Z.]*,void 0,[a-zA-Z.]*,"([a-zA-Z]+)"/g)) actionIds.set(m[2], m[1]);
  }
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  pageOfAction = new Map();
  for (const [id, info] of Object.entries(manifest)) {
    const page = Object.keys(info.workers)[0] ?? "";
    // "app/(tienda)/checkout/page" -> "/checkout"; "[x]" -> "x"
    const route = "/" + page.replace(/^app\//, "").replace(/\/page$/, "").split("/").filter((p) => !/^\(.*\)$/.test(p)).join("/").replace(/\[([^\]]+)\]/g, "x");
    pageOfAction.set(id, route === "/" ? "/" : route);
  }
}

export function actionId(name) {
  loadActions();
  const id = actionIds.get(name);
  if (!id) throw new Error(`Acción desconocida en el build: ${name}`);
  return id;
}

/** Interpreta la respuesta "flight" de una acción: el valor devuelto es el trozo al que apunta la fila raíz (`"a":"$@N"`). */
function parseFlight(text) {
  const chunks = new Map();
  for (const line of text.split(String.fromCharCode(10))) {
    const m = /^([0-9a-f]+):(.*)$/.exec(line);
    if (m) chunks.set(m[1], m[2]);
  }
  const parse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };
  const root = chunks.has("0") ? parse(chunks.get("0")) : undefined;
  const ref = root && typeof root === "object" ? root.a : undefined;
  const m = typeof ref === "string" ? /^\$@([0-9a-f]+)$/.exec(ref) : null;
  if (m && chunks.has(m[1])) return parse(chunks.get(m[1]));
  if (ref !== undefined && !(typeof ref === "string" && ref.startsWith("$"))) return ref;
  // Sin fila raíz con referencia (errores, redirecciones): el último trozo.
  let last;
  for (const [id, raw] of chunks) if (id !== "0") last = parse(raw);
  return last;
}

/**
 * Llama a una acción del servidor. `args`: arreglo con los argumentos. Un `FormData` como argumento se
 * envía como lo hace el navegador (multipart con referencia $K).
 */
export async function callAction(name, args, { cookie, base = APP_URL, origin, headers = {}, route, noOrigin = false } = {}) {
  const id = actionId(name);
  const path = route ?? pageOfAction.get(id) ?? "/";
  const h = { "Next-Action": id, Accept: "text/x-component", "x-real-ip": RUN_IP, ...headers };
  if (cookie) h.Cookie = cookie;
  if (origin) h.Origin = origin;
  else if (!noOrigin) h.Origin = base;
  let body;
  const hasForm = args.some((a) => a instanceof FormData);
  if (hasForm) {
    body = new FormData();
    const refs = args.map((a, i) => {
      if (!(a instanceof FormData)) return a;
      const n = i + 1;
      for (const [k, v] of a.entries()) body.append(`_${n}_${k}`, v);
      return `$K${n}`;
    });
    body.set("0", JSON.stringify(refs));
  } else {
    h["Content-Type"] = "text/plain;charset=UTF-8";
    body = JSON.stringify(args);
  }
  const res = await fetch(base + path, { method: "POST", headers: h, body, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, redirect: res.headers.get("x-action-redirect") ?? res.headers.get("location"), value: parseFlight(text), text, headers: res.headers };
}

/** GET de una página de la app (sin seguir redirecciones). */
export async function getPage(path, { cookie, base = APP_URL, headers = {} } = {}) {
  const res = await fetch(base + path, { redirect: "manual", headers: { "x-real-ip": RUN_IP, ...(cookie ? { Cookie: cookie } : {}), ...headers } });
  const text = await res.text();
  return { status: res.status, location: res.headers.get("location"), text, headers: res.headers };
}

export async function appUp(base = APP_URL) {
  try {
    const r = await fetch(base + "/robots.txt", { signal: AbortSignal.timeout(4000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

/** FormData a partir de un objeto simple. */
export function form(obj) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

// ---------------------------------------------------------------------------
// Datos de prueba (prefijo zz-sec-)
// ---------------------------------------------------------------------------
/** Subcategoría visible existente donde colgar los productos de prueba. */
export async function anyVisibleSubcategory() {
  const r = await svc("GET", "/rest/v1/visible_categories?select=id,parent_id&parent_id=not.is.null&limit=1");
  return r.json?.[0]?.id ?? null;
}

export async function ensureProduct(slugSuffix, { nombre, precio = 10, stock = 5, activo = true, categoryId }) {
  const slug = `${PREFIX}${slugSuffix}`;
  const cat = categoryId ?? (await anyVisibleSubcategory());
  const found = await svc("GET", `/rest/v1/products?slug=eq.${slug}&select=id`);
  if (found.json?.[0]) {
    const id = found.json[0].id;
    // Se reinicia el estado: sin reservas ajenas (datos de prueba).
    await svc("PATCH", `/rest/v1/products?id=eq.${id}`, { stock, stock_reservado: 0, precio, activo, category_id: cat, nombre: nombre ?? slug });
    return id;
  }
  const r = await svc("POST", "/rest/v1/products", { nombre: nombre ?? slug, slug, precio, stock, activo, category_id: cat, descripcion: "Producto de prueba de seguridad" });
  if (r.status >= 300) throw new Error(`No se pudo crear el producto de prueba ${slug}: ${r.status} ${r.text}`);
  return r.json[0].id;
}

/** Hace vencer los pedidos pendientes de prueba de esas cuentas (libera la reserva por la vía normal). */
export async function expirePending(userIds) {
  for (const uid of userIds) {
    const pend = await svc("GET", `/rest/v1/orders?user_id=eq.${uid}&estado=eq.pendiente_pago&select=id,order_items!inner(nombre)&order_items.nombre=like.${PREFIX}*`);
    for (const o of pend.json ?? []) await svc("PATCH", `/rest/v1/orders?id=eq.${o.id}`, { vence_en: "2020-01-01T00:00:00Z" });
  }
  await svc("POST", "/rest/v1/rpc/expire_orders", {});
}

/** Quita del carrito de la cuenta SOLO las líneas de productos de prueba. */
export async function clearTestCart(userId) {
  const lines = await svc("GET", `/rest/v1/cart_items?user_id=eq.${userId}&select=product_id,products!inner(slug)&products.slug=like.${PREFIX}*`);
  for (const l of lines.json ?? []) await svc("DELETE", `/rest/v1/cart_items?user_id=eq.${userId}&product_id=eq.${l.product_id}`);
}

export async function setCart(userId, lines) {
  await clearTestCart(userId);
  if (lines.length === 0) return;
  const r = await svc("POST", "/rest/v1/cart_items", lines.map((l) => ({ user_id: userId, product_id: l.productId, cantidad: l.cantidad })));
  if (r.status >= 300) throw new Error(`No se pudo preparar el carrito: ${r.status} ${r.text}`);
}

export const VALID_ADDRESS = { etiqueta: "zz-sec-casa", provincia: "Guayas", ciudad: "Guayaquil", direccion: "zz-sec Calle falsa 123", referencia: "" };
export const CHECKOUT_OK = { nombre: "zz-sec Cliente", telefono: "0991234567", address: VALID_ADDRESS, acepta: true };

/** Llama a `create_order` como el servidor (service_role) con un total coherente. */
export async function createOrderRpc(userId, items, { total } = {}) {
  const subtotal = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  return svc("POST", "/rest/v1/rpc/create_order", {
    p_user_id: userId,
    p_nombre: "zz-sec Cliente",
    p_email: "zz-sec@example.com",
    p_telefono: "0991234567",
    p_direccion: { ciudad: "zz-sec" },
    p_items: items,
    p_subtotal: subtotal,
    p_descuento: 0,
    p_descuento_transferencia: 0,
    p_envio: 0,
    p_total: total ?? subtotal,
    p_horas_limite: 48,
  });
}

export async function productRow(id) {
  const r = await svc("GET", `/rest/v1/products?id=eq.${id}&select=stock,stock_reservado,activo`);
  return r.json?.[0];
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Cuentas de prueba: si no existen en el proyecto, las pruebas con sesión se saltan (nunca se crean cuentas aquí)
// ---------------------------------------------------------------------------
export const NO_ACCOUNTS = "las cuentas ATTACK_* de .env.local no existen en este proyecto de Supabase (el login fue rechazado)";

export async function trySession(who) {
  try {
    return await sessionFor(who);
  } catch {
    return null;
  }
}

/** Fila de `profiles` por service_role (rol, constancia de términos…). */
export async function profileOf(userId) {
  const r = await svc("GET", `/rest/v1/profiles?id=eq.${userId}&select=*`);
  return r.json?.[0];
}

/** Dirección de prueba de un cliente (la crea el propio cliente con su token, como lo haría la app). */
export async function ensureAddress(session) {
  const found = await rest("GET", `/rest/v1/customer_addresses?user_id=eq.${session.userId}&etiqueta=eq.${PREFIX}victima&select=id`, { token: session.token });
  if (found.json?.[0]) return found.json[0].id;
  const r = await rest("POST", "/rest/v1/customer_addresses", {
    token: session.token,
    headers: { Prefer: "return=representation" },
    body: { user_id: session.userId, etiqueta: `${PREFIX}victima`, destinatario: "zz-sec Victima", telefono: "0991234567", provincia: "Guayas", ciudad: "Guayaquil", direccion: "zz-sec Calle de la victima 1", referencia: null, es_predeterminada: false },
  });
  if (r.status >= 300) throw new Error(`no se pudo crear la dirección de prueba: ${r.status} ${r.text}`);
  return r.json[0].id;
}

/** Sube un archivo de prueba al bucket privado de comprobantes (preparación con service_role). */
export async function uploadFixtureProof(path, bytes) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/payment-proofs/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
    body: bytes,
  });
  if (res.status >= 300) throw new Error(`no se pudo subir el archivo de prueba: ${res.status} ${await res.text()}`);
}

export const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), Buffer.from("JFIF zz-sec")]);

/**
 * Un pedido de prueba de `session` con una línea del producto `product`, creado como lo hace el servidor
 * (carrito + create_order). Si `withProof`, además un comprobante en revisión.
 */
export async function makeOrder(session, product, { cantidad = 1, withProof = false } = {}) {
  await setCart(session.userId, [{ productId: product.id, cantidad }]);
  const r = await createOrderRpc(session.userId, [{ product_id: product.id, nombre: product.nombre, precio_unitario: product.precio, cantidad }]);
  if (r.status >= 300) throw new Error(`no se pudo crear el pedido de prueba: ${r.status} ${r.text}`);
  const o = Array.isArray(r.json) ? r.json[0] : r.json;
  const order = { id: o.o_id, referencia: o.o_referencia };
  if (withProof) {
    const path = `${session.userId}/${order.id}/${PREFIX}${Date.now().toString(36)}.jpg`;
    await uploadFixtureProof(path, JPEG_BYTES);
    const hash = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const p = await svc("POST", "/rest/v1/rpc/submit_payment_proof", { p_user_id: session.userId, p_order_id: order.id, p_archivo: path, p_hash: hash });
    if (p.status >= 300) throw new Error(`no se pudo subir el comprobante de prueba: ${p.status} ${p.text}`);
    const row = Array.isArray(p.json) ? p.json[0] : p.json;
    order.proofId = row.o_proof_id;
    order.proofPath = path;
  }
  return order;
}

export async function getProduct(id) {
  const r = await svc("GET", `/rest/v1/products?id=eq.${id}&select=id,nombre,precio,stock,stock_reservado,activo`);
  return r.json?.[0];
}

export async function orderRow(id) {
  const r = await svc("GET", `/rest/v1/orders?id=eq.${id}&select=*`);
  return r.json?.[0];
}

/** Categoría de prueba (idempotente por slug). `activa` se vuelve a fijar cada vez. */
export async function ensureCategory(slug, nombre, parentId, activa = true) {
  const found = await svc("GET", `/rest/v1/categories?slug=eq.${slug}&select=id`);
  if (found.json?.[0]) {
    await svc("PATCH", `/rest/v1/categories?id=eq.${found.json[0].id}`, { nombre, activa });
    return found.json[0].id;
  }
  const r = await svc("POST", "/rest/v1/categories", { nombre, slug, parent_id: parentId, activa });
  if (r.status >= 300) throw new Error(`no se pudo crear la categoría de prueba: ${r.status} ${r.text}`);
  return r.json[0].id;
}
