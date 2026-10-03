// Pruebas de ATAQUE contra la API REST de Supabase, con el token anon y con el de un cliente normal (no admin).
// Todo debe FALLAR (o no devolver nada). Solo para un proyecto de DESARROLLO. Sin llaves dentro: lee el entorno.
//
//   npm run test:attack
//
// Variables (se leen de .env.local con --env-file; nunca se imprimen):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   (ya existen)
//   ATTACK_CUSTOMER_EMAIL, ATTACK_CUSTOMER_PASSWORD           (una cuenta de CLIENTE de prueba; opcional)
//   ATTACK_CUSTOMER_TOKEN                                     (alternativa: un access_token de ese cliente)
//   ATTACK_OTHER_USER_ID                                      (opcional: id de OTRO usuario, para probar su carpeta de Storage)
// Sin credenciales de cliente se ejecuta solo la parte anónima. Los intentos de escritura usan datos con
// el prefijo "zz-ataque": si alguno llegara a funcionar, la prueba falla y esa fila debe borrarse a mano.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ZERO = "00000000-0000-0000-0000-000000000000";
const missing = !URL_BASE || !ANON;

const report = [];

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** ¿Llegaron filas? (una respuesta de éxito con contenido). */
const gotRows = (r) => r.status < 300 && Array.isArray(r.json) && r.json.length > 0;
const denied = (r) => r.status >= 400 || (r.status < 300 && (r.json === null || (Array.isArray(r.json) && r.json.length === 0)));

function record(actor, intento, esperado, r, ok) {
  report.push({ actor, intento, esperado, real: `${r.status}${Array.isArray(r.json) ? ` (${r.json.length} filas)` : ""}`, ok });
}

/** Una lectura no puede devolver filas ajenas. */
async function expectNoRows(actor, token, table, query = "select=*&limit=5") {
  const r = await call("GET", `/rest/v1/${table}?${query}`, { token });
  const ok = !gotRows(r);
  record(actor, `leer ${table}`, "sin filas / error", r, ok);
  assert.ok(ok, `${actor} leyó ${table}: ${r.status}`);
}

async function expectWriteDenied(actor, token, method, path, body, label) {
  const r = await call(method, path, { token, body, headers: { Prefer: "return=representation" } });
  const ok = !gotRows(r) && (r.status >= 400 || r.json === null || (Array.isArray(r.json) && r.json.length === 0));
  record(actor, label, "rechazado / 0 filas", r, ok);
  assert.ok(ok, `${actor}: ${label} funcionó (${r.status})`);
}

async function expectRpcDenied(actor, token, fn, args = {}) {
  const r = await call("POST", `/rest/v1/rpc/${fn}`, { token, body: args });
  // Éxito de verdad = 2xx. Un 4xx/5xx (sin permiso, no autorizado, argumentos inválidos) es un rechazo.
  const ok = r.status >= 400;
  record(actor, `rpc ${fn}`, "rechazado (4xx)", r, ok);
  assert.ok(ok, `${actor} ejecutó ${fn}: ${r.status}`);
}

const READ_TABLES = [
  "orders",
  "order_items",
  "payment_proofs",
  "contact_messages",
  "email_log",
  "rate_limits",
  "store_settings",
  "customer_addresses",
  "cart_items",
  "profiles",
];

const ADMIN_RPCS = [
  ["admin_approve_order", { p_order_id: ZERO, p_proof_id: ZERO }],
  ["admin_reject_proof", { p_order_id: ZERO, p_proof_id: ZERO, p_motivo: "zz-ataque" }],
  ["admin_reject_order", { p_order_id: ZERO, p_motivo: "zz-ataque" }],
  ["admin_cancel_order", { p_order_id: ZERO, p_motivo: "zz-ataque" }],
  ["admin_mark_shipped", { p_order_id: ZERO }],
  ["admin_mark_delivered", { p_order_id: ZERO }],
  ["admin_mark_message_read", { p_id: ZERO }],
  ["admin_archive_message", { p_id: ZERO }],
  ["admin_move_category", { p_id: ZERO, p_direction: "up" }],
  ["admin_dashboard_summary", {}],
  ["admin_stock_alerts", { p_limit: 5 }],
];

// Funciones que solo el servidor (service_role) puede ejecutar.
const SERVER_RPCS = [
  ["create_order", { p_user_id: ZERO, p_nombre: "zz-ataque", p_email: "a@b.co", p_telefono: "0991234567", p_direccion: {}, p_items: [], p_subtotal: 1, p_descuento: 0, p_descuento_transferencia: 0, p_envio: 0, p_total: 1, p_horas_limite: 48 }],
  ["submit_payment_proof", { p_user_id: ZERO, p_order_id: ZERO, p_archivo: "zz-ataque/x.png", p_hash: "a".repeat(64) }],
  ["create_contact_message", { p_nombre: "zz-ataque", p_email: "a@b.co", p_telefono: "0991234567", p_asunto: null, p_mensaje: "zz-ataque mensaje de prueba", p_acepta: true, p_ip_hash: null }],
  ["rate_limit_hit", { p_bucket: "zz_ataque", p_clave: "a".repeat(64), p_max: 1, p_ventana: "1 hour" }],
  ["email_log_claim", { p_tipo: "zz_ataque", p_referencia: "x", p_hash: "a".repeat(64), p_mascara: "a***@b***.co" }],
  ["email_log_finish", { p_id: ZERO, p_estado: "enviado", p_error: null }],
  ["cleanup_rate_limits", {}],
  ["cleanup_email_log", {}],
  ["expire_orders", {}],
];

const WRITES = [
  ["POST", "/rest/v1/products", { nombre: "zz-ataque", slug: "zz-ataque", precio: 1, stock: 1, category_id: ZERO }, "insertar un producto"],
  ["PATCH", `/rest/v1/products?id=eq.${ZERO}`, { precio: 0.01 }, "cambiar el precio de un producto"],
  ["DELETE", `/rest/v1/products?id=eq.${ZERO}`, undefined, "borrar un producto"],
  ["POST", "/rest/v1/discounts", { nombre: "zz-ataque", tipo: "porcentaje", valor: 99, alcance: "tienda" }, "crear un descuento"],
  ["PATCH", "/rest/v1/discounts?id=not.is.null", { valor: 99 }, "modificar todos los descuentos"],
  ["POST", "/rest/v1/categories", { nombre: "zz-ataque", slug: "zz-ataque" }, "crear una categoría"],
  ["PATCH", "/rest/v1/orders?id=not.is.null", { estado: "pagado" }, "marcar pedidos como pagados"],
  ["PATCH", `/rest/v1/orders?id=eq.${ZERO}`, { estado: "pagado" }, "cambiar el estado de un pedido"],
  ["POST", "/rest/v1/orders", { contacto_nombre: "zz-ataque", contacto_email: "a@b.co", contacto_telefono: "0991234567", subtotal: 1, total: 1, vence_en: "2099-01-01T00:00:00Z" }, "crear un pedido directo (saltar el límite de 3 pendientes)"],
  ["POST", "/rest/v1/order_items", { order_id: ZERO, nombre: "zz-ataque", precio_unitario: 0.01, cantidad: 1 }, "insertar líneas de pedido"],
  ["PATCH", "/rest/v1/payment_proofs?id=not.is.null", { estado: "aprobado" }, "aprobar comprobantes"],
  ["POST", "/rest/v1/payment_proofs", { order_id: ZERO, archivo: "zz-ataque/x.png", hash: "a".repeat(64) }, "insertar un comprobante"],
  ["PATCH", "/rest/v1/store_settings?id=eq.true", { descuento_transferencia_pct: 99 }, "cambiar la configuración de la tienda"],
  ["POST", "/rest/v1/contact_messages", { nombre: "zz-ataque", email: "a@b.co", telefono: "0991234567", mensaje: "zz-ataque mensaje de prueba", aceptado_en: "2026-01-01T00:00:00Z" }, "insertar un mensaje de contacto directo"],
  ["PATCH", "/rest/v1/contact_messages?id=not.is.null", { estado: "leido" }, "cambiar el estado de los mensajes"],
  ["POST", "/rest/v1/email_log", { tipo: "zz_ataque", referencia_id: "x", destinatario_hash: "a".repeat(64), destinatario_mascara: "a***@b.co", estado: "enviado" }, "escribir en email_log"],
  ["DELETE", "/rest/v1/email_log?id=not.is.null", undefined, "borrar email_log"],
  ["POST", "/rest/v1/rate_limits", { bucket: "zz_ataque", clave: "a".repeat(64), ventana_inicio: "2026-01-01T00:00:00Z", expira_en: "2099-01-01T00:00:00Z", intentos: 1 }, "escribir en rate_limits"],
];

describe("anon", { skip: missing && "faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY" }, () => {
  for (const t of READ_TABLES) test(`no lee ${t}`, () => expectNoRows("anon", undefined, t));
  test("no lee cupones de descuento (solo los automáticos y vigentes)", async () => {
    const r = await call("GET", "/rest/v1/discounts?codigo=not.is.null&select=id,codigo");
    const ok = !gotRows(r);
    record("anon", "leer descuentos con cupón", "sin filas", r, ok);
    assert.ok(ok);
  });
  test("no lee productos inactivos", async () => {
    const r = await call("GET", "/rest/v1/products?activo=eq.false&select=id&limit=5");
    const ok = !gotRows(r);
    record("anon", "leer productos inactivos", "sin filas", r, ok);
    assert.ok(ok);
  });
  test("control positivo: sí lee lo público (store_public_info y categorías visibles)", async () => {
    const info = await call("GET", "/rest/v1/store_public_info?select=nombre_negocio");
    assert.equal(info.status, 200, "store_public_info debe poder leerse");
    const cols = await call("GET", "/rest/v1/store_public_info?select=cuentas_bancarias");
    assert.ok(cols.status >= 400, "la vista pública NO debe exponer las cuentas bancarias");
    record("anon", "leer cuentas_bancarias por la vista pública", "error", cols, cols.status >= 400);
  });
  for (const [m, p, b, label] of WRITES) test(`no puede ${label}`, () => expectWriteDenied("anon", undefined, m, p, b, label));
  for (const [fn, args] of [...ADMIN_RPCS, ...SERVER_RPCS]) test(`no ejecuta ${fn}`, () => expectRpcDenied("anon", undefined, fn, args));
  test("Storage: no sube, no lista y no lee comprobantes", async () => {
    const up = await call("POST", "/storage/v1/object/payment-proofs/zz-ataque/x.png", { body: {} });
    const upImg = await call("POST", "/storage/v1/object/product-images/zz-ataque/x.png", { body: {} });
    const list = await call("POST", "/storage/v1/object/list/payment-proofs", { body: { prefix: "", limit: 5 } });
    const read = await fetch(`${URL_BASE}/storage/v1/object/public/payment-proofs/x.png`);
    const results = [
      ["subir a payment-proofs", up.status >= 400],
      ["subir a product-images", upImg.status >= 400],
      ["listar payment-proofs", !gotRows(list)],
      ["leer por URL pública payment-proofs", read.status >= 400],
    ];
    for (const [label, ok] of results) {
      record("anon", `Storage: ${label}`, "rechazado", { status: 0, json: null }, ok);
      assert.ok(ok, label);
    }
  });
});

// El login se intenta ANTES de declarar las pruebas: si las cuentas ATTACK_* no existen en el proyecto (login
// rechazado), la parte de cliente se SALTA con un aviso en vez de fallar en cadena.
let customerToken = process.env.ATTACK_CUSTOMER_TOKEN || null;
let customerSkipReason = null;
if (!missing && !customerToken) {
  if (process.env.ATTACK_CUSTOMER_EMAIL && process.env.ATTACK_CUSTOMER_PASSWORD) {
    const r = await call("POST", "/auth/v1/token?grant_type=password", { body: { email: process.env.ATTACK_CUSTOMER_EMAIL, password: process.env.ATTACK_CUSTOMER_PASSWORD } });
    if (r.status === 200) customerToken = r.json.access_token;
    else customerSkipReason = `la cuenta ATTACK_CUSTOMER no existe o su contraseña es incorrecta en este proyecto (login ${r.status})`;
  } else {
    customerSkipReason = "sin ATTACK_CUSTOMER_EMAIL/PASSWORD ni ATTACK_CUSTOMER_TOKEN";
  }
}

describe("cliente normal", { skip: (missing && "faltan variables de Supabase") || (customerSkipReason ?? false) }, () => {
  let token = customerToken;
  let userId = null;
  const hasCreds = Boolean(token);

  test("inicia sesión como cliente de prueba (y no es admin)", async () => {
    const me = await call("GET", "/auth/v1/user", { token });
    assert.equal(me.status, 200);
    userId = me.json.id;
    const profile = await call("GET", `/rest/v1/profiles?id=eq.${userId}&select=role`, { token });
    assert.equal(profile.json?.[0]?.role, "customer", "la cuenta de prueba debe ser de cliente, no admin");
  });

  const guard = (fn) => async () => {
    assert.ok(token && userId, "sin sesión de cliente");
    return fn();
  };
  const opts = { skip: !hasCreds && "sin credenciales de cliente" };

  test("solo ve SUS pedidos, direcciones, carrito y perfil", opts, guard(async () => {
    for (const t of ["orders", "customer_addresses", "cart_items", "profiles"]) {
      const col = t === "profiles" ? "id" : "user_id";
      const r = await call("GET", `/rest/v1/${t}?select=${col}&limit=200`, { token });
      const foreign = Array.isArray(r.json) ? r.json.filter((row) => row[col] !== userId).length : 0;
      record("cliente", `leer ${t} ajenos`, "0 filas ajenas", r, foreign === 0);
      assert.equal(foreign, 0, `${t}: filas de otros usuarios`);
    }
    const proofs = await call("GET", "/rest/v1/payment_proofs?select=id,order_id,orders!inner(user_id)&limit=200", { token });
    const foreignProofs = Array.isArray(proofs.json) ? proofs.json.filter((p) => p.orders?.user_id !== userId).length : 0;
    record("cliente", "leer comprobantes ajenos", "0 filas ajenas", proofs, foreignProofs === 0);
    assert.equal(foreignProofs, 0);
  }));

  for (const t of ["contact_messages", "email_log", "rate_limits", "store_settings"]) {
    test(`no lee ${t}`, opts, guard(() => expectNoRows("cliente", token, t)));
  }
  test("no lee las direcciones ni los pedidos de otro usuario por filtro", opts, guard(async () => {
    for (const t of ["orders", "customer_addresses"]) {
      const r = await call("GET", `/rest/v1/${t}?user_id=neq.${userId}&select=id&limit=5`, { token });
      const ok = !gotRows(r);
      record("cliente", `leer ${t} de otros (user_id=neq)`, "sin filas", r, ok);
      assert.ok(ok);
    }
  }));

  for (const [m, p, b, label] of WRITES) test(`no puede ${label}`, opts, guard(() => expectWriteDenied("cliente", token, m, p, b, label)));

  test("no puede subirse el rol a admin ni cambiar el perfil de otro", opts, guard(async () => {
    await expectWriteDenied("cliente", token, "PATCH", `/rest/v1/profiles?id=eq.${userId}`, { role: "admin" }, "ponerse role=admin");
    await expectWriteDenied("cliente", token, "PATCH", `/rest/v1/profiles?id=neq.${userId}`, { full_name: "zz-ataque" }, "cambiar el nombre de otros perfiles");
    const me = await call("GET", `/rest/v1/profiles?id=eq.${userId}&select=role`, { token });
    assert.equal(me.json?.[0]?.role, "customer");
  }));
  test("no puede cambiar el estado de SUS propios pedidos", opts, guard(() =>
    expectWriteDenied("cliente", token, "PATCH", `/rest/v1/orders?user_id=eq.${userId}`, { estado: "pagado" }, "marcar su propio pedido como pagado")));
  test("no puede mover direcciones o carrito de otros", opts, guard(async () => {
    await expectWriteDenied("cliente", token, "PATCH", `/rest/v1/customer_addresses?user_id=neq.${userId}`, { ciudad: "zz-ataque" }, "editar direcciones ajenas");
    await expectWriteDenied("cliente", token, "DELETE", `/rest/v1/customer_addresses?user_id=neq.${userId}`, undefined, "borrar direcciones ajenas");
    await expectWriteDenied("cliente", token, "PATCH", `/rest/v1/cart_items?user_id=neq.${userId}`, { cantidad: 99 }, "editar carritos ajenos");
    await expectWriteDenied("cliente", token, "POST", "/rest/v1/cart_items", { user_id: ZERO, product_id: ZERO, cantidad: 1 }, "poner productos en el carrito de otro");
  }));
  for (const [fn, args] of [...ADMIN_RPCS, ...SERVER_RPCS]) test(`no ejecuta ${fn}`, opts, guard(() => expectRpcDenied("cliente", token, fn, args)));

  test("Storage: no sube a ningún bucket ni lee archivos de otro usuario", opts, guard(async () => {
    const other = process.env.ATTACK_OTHER_USER_ID || ZERO;
    const checks = [
      ["subir a payment-proofs", await call("POST", `/storage/v1/object/payment-proofs/${userId}/zz-ataque.png`, { token, body: {} })],
      ["subir a product-images", await call("POST", "/storage/v1/object/product-images/zz-ataque/x.png", { token, body: {} })],
      ["leer un comprobante de otro usuario", await call("GET", `/storage/v1/object/authenticated/payment-proofs/${other}/x.png`, { token })],
      ["leer un comprobante propio (también denegado: solo el admin los ve)", await call("GET", `/storage/v1/object/authenticated/payment-proofs/${userId}/x.png`, { token })],
    ];
    for (const [label, r] of checks) {
      const ok = r.status >= 400;
      record("cliente", `Storage: ${label}`, "rechazado", r, ok);
      assert.ok(ok, label);
    }
    const list = await call("POST", "/storage/v1/object/list/payment-proofs", { token, body: { prefix: "", limit: 20 } });
    const ok = !gotRows(list);
    record("cliente", "Storage: listar payment-proofs", "sin objetos", list, ok);
    assert.ok(ok);
  }));
});

after(() => {
  if (report.length === 0) return;
  console.log("\n=== RESUMEN DE INTENTOS (actor | intento | esperado | real | resultado) ===");
  for (const r of report) console.log(`${r.ok ? "OK    " : "FALLÓ "} ${r.actor} | ${r.intento} | ${r.esperado} | ${r.real}`);
  console.log(`Total: ${report.length}, fallidos: ${report.filter((r) => !r.ok).length}`);
});
