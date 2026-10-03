// B. ADMINISTRADOR SIN SEGUNDO FACTOR (sesión aal1: contraseña correcta, código de 2 pasos nunca completado)
// y B7: un cliente normal contra la administración. Todo debe fallar: por la API (RPC, tablas, Storage), por las
// rutas /admin y por las acciones del servidor del panel. Cuentas: ATTACK_ADMIN_NO2FA_* y ATTACK_CUSTOMER_*.
// IMPORTANTE: no se registra ni se verifica ningún factor 2FA; esa cuenta no debe cambiar de estado.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  NO_ACCOUNTS, PREFIX, SUPABASE_URL, ZERO, anyVisibleSubcategory, appUp, assertDevOnly, callAction, check, form, getPage, gotRows, haveService,
  installSummary, rec, rest, svc, trySession, uploadFixtureProof, writeDenied, JPEG_BYTES,
} from "./lib.mjs";

installSummary("B. Admin sin 2FA y cliente contra /admin");
const adm = await trySession("admin");
const c1 = await trySession("c1");
const up = await appUp();
const skipAdmin = (!adm || !haveService) && (NO_ACCOUNTS + (haveService ? "" : " / falta service_role"));
const skipCust = (!c1 || !haveService) && (NO_ACCOUNTS + (haveService ? "" : " / falta service_role"));
if (!skipAdmin || !skipCust) assertDevOnly();
const run = Date.now().toString(36);
const ADMIN_FN = [
  ["admin_approve_order", { p_order_id: ZERO, p_proof_id: ZERO }],
  ["admin_reject_proof", { p_order_id: ZERO, p_proof_id: ZERO, p_motivo: "zz-sec" }],
  ["admin_reject_order", { p_order_id: ZERO, p_motivo: "zz-sec" }],
  ["admin_cancel_order", { p_order_id: ZERO, p_motivo: "zz-sec" }],
  ["admin_mark_shipped", { p_order_id: ZERO }],
  ["admin_mark_delivered", { p_order_id: ZERO }],
  ["admin_mark_message_read", { p_id: ZERO }],
  ["admin_archive_message", { p_id: ZERO }],
  ["admin_move_category", { p_id: ZERO, p_direction: "up" }],
  ["admin_dashboard_summary", {}],
  ["admin_stock_alerts", { p_limit: 5 }],
];
const PANEL_ROUTES = ["/admin", "/admin/productos", "/admin/productos/nuevo", "/admin/categorias", "/admin/descuentos", "/admin/pedidos", "/admin/pedidos/MC-AAAAAAAA", "/admin/configuracion", "/admin/mensajes"];

describe("B6. admin con solo contraseña (aal1): API REST", { skip: skipAdmin }, () => {
  const T = () => ({ token: adm.token, headers: { Prefer: "return=representation" } });

  test("no es is_admin() y no ejecuta ninguna función admin_*", async () => {
    const who = await rest("POST", "/rest/v1/rpc/is_admin", { token: adm.token, body: {} });
    check(assert, "B6", "is_admin() con sesión aal1", "false (o rechazado)", `${who.status} ${JSON.stringify(who.json)}`, who.status >= 400 || who.json === false);
    for (const [fn, args] of ADMIN_FN) {
      const r = await rest("POST", `/rest/v1/rpc/${fn}`, { token: adm.token, body: args });
      check(assert, "B6", `rpc ${fn} con aal1`, "rechazado (4xx)", r.status, r.status >= 400);
    }
  });

  test("no lee pedidos, comprobantes, mensajes, registro de correos, límites, configuración completa ni cupones", async () => {
    for (const t of ["orders", "order_items", "payment_proofs", "contact_messages", "email_log", "rate_limits", "store_settings", "customer_addresses", "cart_items"]) {
      const r = await rest("GET", `/rest/v1/${t}?select=*&limit=5`, { token: adm.token });
      check(assert, "B6", `leer ${t} con aal1`, "sin filas", `${r.status}${Array.isArray(r.json) ? ` (${r.json.length})` : ""}`, !gotRows(r));
    }
    const profiles = await rest("GET", "/rest/v1/profiles?select=id&limit=50", { token: adm.token });
    check(assert, "B6", "leer profiles ajenos con aal1", "solo el propio", `${profiles.status} (${profiles.json?.length} filas)`, Array.isArray(profiles.json) && profiles.json.every((p) => p.id === adm.userId));
    const inactive = await rest("GET", "/rest/v1/products?activo=eq.false&select=id&limit=5", { token: adm.token });
    check(assert, "B6", "leer productos inactivos con aal1", "sin filas", `${inactive.status}`, !gotRows(inactive));
    const coupons = await rest("GET", "/rest/v1/discounts?codigo=not.is.null&select=id,codigo", { token: adm.token });
    check(assert, "B6", "leer cupones con aal1", "sin filas", `${coupons.status}`, !gotRows(coupons));
  });

  test("no escribe productos, categorías, descuentos, configuración, mensajes, pedidos ni comprobantes", async () => {
    const sub = await anyVisibleSubcategory();
    const writes = [
      ["insertar producto", "POST", "/rest/v1/products", { nombre: `${PREFIX}b-prod`, slug: `${PREFIX}b-prod-${run}`, precio: 1, stock: 1, category_id: sub }],
      ["modificar todos los productos", "PATCH", "/rest/v1/products?id=not.is.null", { activo: false }],
      ["borrar productos", "DELETE", `/rest/v1/products?slug=like.${PREFIX}*`],
      ["insertar categoría", "POST", "/rest/v1/categories", { nombre: `${PREFIX}b-cat`, slug: `${PREFIX}b-cat-${run}` }],
      ["modificar categorías", "PATCH", "/rest/v1/categories?id=not.is.null", { activa: false }],
      ["insertar descuento 99 %", "POST", "/rest/v1/discounts", { nombre: `${PREFIX}b-desc`, tipo: "porcentaje", valor: 99, alcance: "tienda" }],
      ["modificar descuentos", "PATCH", "/rest/v1/discounts?id=not.is.null", { activo: false }],
      ["insertar imagen de producto", "POST", "/rest/v1/product_images", { product_id: ZERO, url: `${PREFIX}x.jpg`, orden: 0 }],
      ["configuración: descuento por transferencia 99 %", "PATCH", "/rest/v1/store_settings?id=eq.true", { descuento_transferencia_pct: 99 }],
      ["configuración: cuentas bancarias", "PATCH", "/rest/v1/store_settings?id=eq.true", { cuentas_bancarias: [{ banco: "zz-sec", numero: "1", titular: "x", tipo: "ahorros", identificacion: "1" }] }],
      ["mensajes: marcar leídos", "PATCH", "/rest/v1/contact_messages?id=not.is.null", { estado: "leido" }],
      ["pedidos: marcar pagados", "PATCH", "/rest/v1/orders?id=not.is.null", { estado: "pagado" }],
      ["comprobantes: aprobar", "PATCH", "/rest/v1/payment_proofs?id=not.is.null", { estado: "aprobado" }],
      ["profiles: ascender a otro", "PATCH", `/rest/v1/profiles?id=neq.${adm.userId}`, { role: "admin" }],
    ];
    for (const [label, method, path, body] of writes) {
      const r = await rest(method, path, { ...T(), body });
      check(assert, "B6", label, "rechazado / 0 filas", `${r.status}${Array.isArray(r.json) ? ` (${r.json.length} filas)` : ""}`, writeDenied(r));
    }
    const made = await svc("GET", `/rest/v1/products?slug=like.${PREFIX}b-prod*&select=id`);
    check(assert, "B6", "no quedó ningún producto de prueba creado", "0", made.json?.length, (made.json?.length ?? 0) === 0);
  });

  test("Storage: no ve comprobantes ni sube imágenes de productos", async () => {
    const path = `${PREFIX}${run}/admin-aal1.jpg`;
    await uploadFixtureProof(path, JPEG_BYTES);
    const hdr = { Authorization: `Bearer ${adm.token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    for (const [label, method, url, body] of [
      ["leer un comprobante", "GET", `/storage/v1/object/authenticated/payment-proofs/${path}`],
      ["listar comprobantes", "POST", "/storage/v1/object/list/payment-proofs", { prefix: "", limit: 20 }],
      ["firmar un comprobante", "POST", `/storage/v1/object/sign/payment-proofs/${path}`, { expiresIn: 600 }],
      ["subir una imagen de producto", "POST", `/storage/v1/object/product-images/${PREFIX}${run}/aal1.jpg`, "bytes"],
      ["borrar una imagen de producto", "DELETE", `/storage/v1/object/product-images/${PREFIX}${run}/polyglot.jpg`],
    ]) {
      const res = await fetch(SUPABASE_URL + url, { method, headers: { ...hdr, "Content-Type": body === "bytes" ? "image/jpeg" : "application/json" }, body: body === undefined ? undefined : body === "bytes" ? JPEG_BYTES : JSON.stringify(body) });
      const text = await res.text();
      const signed = /"signedURL":"[^"]+/.test(text);
      const listed = label.startsWith("listar") && res.status < 300 && text.length > 2 && /zz-sec/.test(text);
      check(assert, "B6", `Storage con aal1: ${label}`, "rechazado, vacío o sin URL", `${res.status}${signed ? " (URL FIRMADA)" : ""}${listed ? " (LISTA)" : ""}`, (res.status >= 400 || text === "[]" || text === "") && !signed && !listed);
    }
  });
});

describe("B6. admin con solo contraseña (aal1): rutas /admin y acciones del panel", { skip: skipAdmin || (!up && "no hay servidor") }, () => {
  test("todas las rutas /admin redirigen a /admin/2fa o /admin/verificar (nunca muestran el panel)", async () => {
    for (const p of PANEL_ROUTES) {
      const r = await getPage(p, { cookie: adm.cookie });
      const shows = r.status === 200 && /Cerrar sesión|Salir|Resumen|Pedidos por revisar/.test(r.text.replace(/<script[\s\S]*?<\/script>/g, ""));
      check(assert, "B6", `GET ${p} con aal1`, "307 a /admin/2fa o /admin/verificar", `${r.status} → ${r.location ?? ""}${shows ? " (MUESTRA EL PANEL)" : ""}`, !shows && r.status >= 300 && r.status < 400 && /\/admin\/(2fa|verificar)/.test(r.location ?? ""));
    }
  });

  test("las acciones del panel no se ejecutan: ni por su ruta (el proxy corta) ni por rutas públicas (requireAdmin y RLS)", async () => {
    const fd = (o) => form(o);
    const sub = await anyVisibleSubcategory();
    const calls = [
      ["crearCategoria", [{}, fd({ nombre: `${PREFIX}b-cat-accion-${run}`, parentId: "" })]],
      ["editarCategoria", [{}, fd({ id: ZERO, nombre: `${PREFIX}x` })]],
      ["accionCategoria", [{}, fd({ id: ZERO, intent: "alternar" })]],
      ["eliminarCategoria", [{}, fd({ id: ZERO })]],
      ["guardarConfiguracion", [{}, fd({ descuento_transferencia_pct: "99" })]],
      ["crearDescuento", [{}, fd({ nombre: `${PREFIX}b-desc-accion`, tipo: "porcentaje", valor: "99", alcance: "tienda" })]],
      ["editarDescuento", [{}, fd({ id: ZERO })]],
      ["alternarDescuento", [{}, fd({ id: ZERO })]],
      ["eliminarDescuento", [{}, fd({ id: ZERO })]],
      ["marcarLeido", [{}, fd({ id: ZERO })]],
      ["archivarMensaje", [{}, fd({ id: ZERO })]],
      ["aprobarPedido", [{}, fd({ orderId: ZERO, proofId: ZERO, verificado: "on" })]],
      ["rechazarComprobante", [{}, fd({ orderId: ZERO, proofId: ZERO, motivo: "zz-sec motivo" })]],
      ["rechazarPedido", [{}, fd({ orderId: ZERO, motivo: "zz-sec motivo" })]],
      ["cancelarPedido", [{}, fd({ orderId: ZERO, motivo: "zz-sec motivo" })]],
      ["marcarEnviado", [{}, fd({ orderId: ZERO })]],
      ["marcarEntregado", [{}, fd({ orderId: ZERO })]],
      ["crearProducto", [{ categoryId: sub, nombre: `${PREFIX}b-prod-accion-${run}`, descripcion: "", precio: 1, stock: 1, sku: "", activo: true, destacado: false }]],
      ["editarProducto", [{}, fd({ id: ZERO })]],
      ["alternarProducto", [{}, fd({ id: ZERO })]],
      ["eliminarProducto", [{}, fd({ id: ZERO })]],
      ["subirImagenProducto", [ZERO, fd({ archivo: new File([JPEG_BYTES], "x.jpg", { type: "image/jpeg" }) })]],
      ["accionImagen", [{}, fd({ productId: ZERO, imageId: ZERO, intent: "quitar" })]],
      ["subirImagenCategoria", [ZERO, fd({ archivo: new File([JPEG_BYTES], "x.jpg", { type: "image/jpeg" }) })]],
      ["quitarImagenCategoria", [{}, fd({ id: ZERO })]],
    ];
    for (const [name, args] of calls) {
      // a) por su ruta natural de /admin: el proxy responde antes de llegar a la acción
      const natural = await callAction(name, args, { cookie: adm.cookie });
      const naturalBlocked = natural.status >= 300 && natural.status < 400 && /\/admin\/(2fa|verificar)/.test(natural.redirect ?? "") || (natural.value && natural.value.ok !== true && !natural.value.ok);
      check(assert, "B6", `${name} (ruta /admin) con aal1`, "bloqueada por el proxy o por requireAdmin", `${natural.status} ${natural.redirect ?? JSON.stringify(natural.value ?? "").slice(0, 40)}`, Boolean(naturalBlocked) && natural.value?.ok !== true);
      // b) por una ruta pública: el ID de la acción no está en esa página, o requireAdmin() redirige
      const viaPublic = await callAction(name, args, { cookie: adm.cookie, route: "/contacto" });
      check(assert, "B6", `${name} por /contacto con aal1`, "no se ejecuta", `${viaPublic.status} ${viaPublic.redirect ?? JSON.stringify(viaPublic.value ?? "").slice(0, 40)}`, viaPublic.value?.ok !== true && !(viaPublic.status === 200 && viaPublic.value?.ok));
    }
    // Ningún efecto en la base de datos
    const cat = await svc("GET", `/rest/v1/categories?slug=like.${PREFIX}b-cat*&select=id`);
    const prod = await svc("GET", `/rest/v1/products?slug=like.${PREFIX}b-prod*&select=id`);
    const disc = await svc("GET", `/rest/v1/discounts?nombre=like.${PREFIX}b-desc*&select=id`);
    check(assert, "B6", "no se creó ninguna categoría, producto ni descuento de prueba", "0 / 0 / 0", `${cat.json?.length} / ${prod.json?.length} / ${disc.json?.length}`, !cat.json?.length && !prod.json?.length && !disc.json?.length);
    const settings = await svc("GET", "/rest/v1/store_settings?select=descuento_transferencia_pct");
    check(assert, "B6", "el descuento por transferencia no cambió a 99", "distinto de 99", settings.json?.[0]?.descuento_transferencia_pct, Number(settings.json?.[0]?.descuento_transferencia_pct) !== 99);
  });

  test("las funciones del 2FA no dejan pasar un código inventado", async () => {
    const r = await callAction("verificarCodigo", [{}, form({ code: "000000" })], { cookie: adm.cookie });
    rec("B6", "verificarCodigo con 000000 (aal1)", "rechazado: no es el código real", JSON.stringify(r.value ?? r.redirect).slice(0, 80), r.redirect && /\/admin$|\/admin;/.test(r.redirect) ? "FALLÓ" : "ok");
    assert.ok(!(r.redirect && /^\/admin(;|$)/.test(r.redirect)), "un código inventado no debe llevar al panel");
  });
});

describe("B7. un cliente normal contra la administración", { skip: skipCust || (!up && "no hay servidor") }, () => {
  test("las rutas /admin lo envían a la tienda", async () => {
    for (const p of PANEL_ROUTES) {
      const r = await getPage(p, { cookie: c1.cookie });
      check(assert, "B7", `GET ${p} con cliente`, "307 a / (nunca el panel)", `${r.status} → ${r.location ?? ""}`, r.status >= 300 && r.status < 400 && !/\/admin\/(2fa|verificar)/.test(r.location ?? "") && !/\/admin/.test(r.location ?? ""));
    }
  });
  test("las acciones del panel no se ejecutan con sesión de cliente", async () => {
    const calls = [
      ["crearCategoria", [{}, form({ nombre: `${PREFIX}b7-cat-${run}`, parentId: "" })]],
      ["crearDescuento", [{}, form({ nombre: `${PREFIX}b7-desc`, tipo: "porcentaje", valor: "99", alcance: "tienda" })]],
      ["guardarConfiguracion", [{}, form({ descuento_transferencia_pct: "99" })]],
      ["aprobarPedido", [{}, form({ orderId: ZERO, proofId: ZERO, verificado: "on" })]],
      ["marcarEnviado", [{}, form({ orderId: ZERO })]],
      ["marcarLeido", [{}, form({ id: ZERO })]],
      ["crearProducto", [{ categoryId: ZERO, nombre: `${PREFIX}b7-prod`, descripcion: "", precio: 1, stock: 1, sku: "", activo: true, destacado: false }]],
      ["subirImagenProducto", [ZERO, form({ archivo: new File([JPEG_BYTES], "x.jpg", { type: "image/jpeg" }) })]],
    ];
    for (const [name, args] of calls) {
      for (const route of [undefined, "/contacto", "/carrito"]) {
        const r = await callAction(name, args, { cookie: c1.cookie, route });
        check(assert, "B7", `${name}${route ? ` por ${route}` : ""} con cliente`, "no se ejecuta", `${r.status} ${r.redirect ?? JSON.stringify(r.value ?? "").slice(0, 40)}`, r.value?.ok !== true);
      }
    }
    const cat = await svc("GET", `/rest/v1/categories?slug=like.${PREFIX}b7-cat*&select=id`);
    check(assert, "B7", "no se creó ninguna categoría de prueba", "0", cat.json?.length, !cat.json?.length);
  });
});

describe("B7. sin ninguna sesión", { skip: !up && "no hay servidor" }, () => {
  test("sin ninguna sesión: /admin y sus acciones redirigen a /login", async () => {
    for (const p of PANEL_ROUTES) {
      const r = await getPage(p);
      check(assert, "B7", `GET ${p} sin sesión`, "307 a /login", `${r.status} → ${r.location ?? ""}`, r.status >= 300 && r.status < 400 && /\/login/.test(r.location ?? ""));
    }
    const r = await callAction("aprobarPedido", [{}, form({ orderId: ZERO, proofId: ZERO, verificado: "on" })], {});
    check(assert, "B7", "aprobarPedido sin sesión", "no se ejecuta", `${r.status} ${r.redirect ?? ""}`, r.value?.ok !== true);
  });
});

describe("B7. sin sesión: las acciones del panel por rutas públicas", { skip: !up && "no hay servidor" }, () => {
  test("el ID de una acción de administración no es invocable desde otra ruta ni sin sesión", async () => {
    const names = ["crearCategoria", "crearDescuento", "guardarConfiguracion", "aprobarPedido", "rechazarComprobante", "cancelarPedido", "marcarEnviado", "marcarEntregado", "marcarLeido", "alternarProducto", "eliminarProducto", "editarProducto"];
    for (const name of names) {
      for (const route of [undefined, "/contacto", "/"]) {
        const r = await callAction(name, [{}, form({ id: ZERO, orderId: ZERO, proofId: ZERO, nombre: `${PREFIX}anon-${run}`, verificado: "on", motivo: "zz-sec motivo" })], { route });
        check(assert, "B7", `${name}${route ? ` por ${route}` : ""} sin sesión`, "no se ejecuta", `${r.status} ${r.redirect ?? JSON.stringify(r.value ?? "").slice(0, 40)}`, r.value?.ok !== true && !(r.status === 200 && r.value && !r.value.error && !r.value.fieldErrors && r.redirect === null && r.value.ok));
      }
    }
    const made = await svc("GET", `/rest/v1/categories?slug=like.${PREFIX}anon*&select=id`);
    check(assert, "B7", "no se creó ninguna categoría", "0", made.json?.length, !made.json?.length);
  });
});
