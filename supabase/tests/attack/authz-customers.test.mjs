// A. AUTORIZACIÓN ENTRE CLIENTES. Con sesiones reales de cliente 1 y cliente 2, el cliente 1 intenta leer,
// cambiar y borrar lo del cliente 2, subirse el rol, tocar su propio pedido y usar la dirección o el carrito
// de otro. Todo debe fallar. Los datos de la "víctima" (cliente 2) son de prueba: prefijo zz-sec-.
// Requiere las cuentas ATTACK_CUSTOMER_* y ATTACK_CUSTOMER2_* de .env.local (sin llaves en el código).
import assert from "node:assert/strict";
import { describe, test, before } from "node:test";
import {
  NO_ACCOUNTS, PREFIX, SERVICE, SUPABASE_URL, appUp, assertDevOnly, callAction, check, clearTestCart, ensureAddress, ensureProduct,
  expirePending, getProduct, gotRows, haveService, installSummary, makeOrder, orderRow, profileOf, rest, setCart, svc, trySession, writeDenied, CHECKOUT_OK,
} from "./lib.mjs";

installSummary("A. Autorización entre clientes");
const c1 = await trySession("c1");
const c2 = await trySession("c2");
const up = await appUp();
const skip = (!c1 || !c2 || !haveService) && (NO_ACCOUNTS + (haveService ? "" : " / falta service_role"));
const opts = { skip };
if (!skip) assertDevOnly();

const v = {}; // víctima (cliente 2) y pedido propio del cliente 1

before(async () => {
  if (skip) return;
  await expirePending([c1.userId, c2.userId]);
  v.product = { id: await ensureProduct("a-prod", { nombre: `${PREFIX}a-prod`, precio: 10, stock: 30 }), nombre: `${PREFIX}a-prod`, precio: 10 };
  v.addrId = await ensureAddress(c2);
  v.order = await makeOrder(c2, v.product, { withProof: true });
  v.before = await orderRow(v.order.id);
  v.profile = await profileOf(c2.userId);
  await setCart(c2.userId, [{ productId: v.product.id, cantidad: 3 }]);
  v.own = await makeOrder(c1, v.product, { cantidad: 1, withProof: true });
  v.ownBefore = await orderRow(v.own.id);
  v.c1profile = await profileOf(c1.userId);
});

const asC1 = (method, path, body) => rest(method, path, { token: c1.token, body, headers: { Prefer: "return=representation" } });

describe("A1. el cliente 1 contra los datos del cliente 2 (API REST)", opts, () => {
  test("lectura: pedidos, líneas, comprobantes, direcciones, carrito y perfil ajenos", async () => {
    const reads = [
      ["pedido por id", `/rest/v1/orders?id=eq.${v.order.id}&select=*`],
      ["pedido por referencia MC-…", `/rest/v1/orders?referencia=eq.${v.order.referencia}&select=*`],
      ["pedido por user_id", `/rest/v1/orders?user_id=eq.${c2.userId}&select=id`],
      ["pedido por correo de contacto", `/rest/v1/orders?contacto_email=ilike.*&user_id=neq.${c1.userId}&select=id`],
      ["líneas del pedido", `/rest/v1/order_items?order_id=eq.${v.order.id}&select=*`],
      ["comprobante por id", `/rest/v1/payment_proofs?id=eq.${v.order.proofId}&select=*`],
      ["comprobantes del pedido", `/rest/v1/payment_proofs?order_id=eq.${v.order.id}&select=*`],
      ["dirección por id", `/rest/v1/customer_addresses?id=eq.${v.addrId}&select=*`],
      ["carrito del cliente 2", `/rest/v1/cart_items?user_id=eq.${c2.userId}&select=*`],
      ["perfil del cliente 2", `/rest/v1/profiles?id=eq.${c2.userId}&select=*`],
      ["relación embebida: comprobante → pedido", `/rest/v1/payment_proofs?select=id,orders(referencia,contacto_email,total)&order_id=eq.${v.order.id}`],
      ["relación embebida: línea → pedido", `/rest/v1/order_items?select=nombre,orders(contacto_email,direccion_envio)&order_id=eq.${v.order.id}`],
      ["relación embebida: producto → líneas de todos", `/rest/v1/products?select=id,order_items(order_id,cantidad)&id=eq.${v.product.id}`],
      ["relación embebida: perfil → pedidos", `/rest/v1/profiles?select=id,orders(referencia)&id=eq.${c2.userId}`],
    ];
    for (const [label, path] of reads) {
      const r = await asC1("GET", path);
      // En las relaciones embebidas basta con que no traigan datos hijos de otro usuario.
      const leakedChild = Array.isArray(r.json) && r.json.some((row) => Object.values(row).some((x) => (Array.isArray(x) && x.length > 0) || (x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length > 0 && label.includes("embebida"))));
      check(assert, "A1", `leer ${label}`, "sin filas ajenas", `${r.status}, ${Array.isArray(r.json) ? r.json.length : "-"} filas${leakedChild ? " (con datos hijos)" : ""}`, !gotRows(r) || (label.includes("producto") && !leakedChild));
    }
  });

  test("escritura y borrado: nada cambia en los datos del cliente 2", async () => {
    const writes = [
      ["PATCH pedido", "PATCH", `/rest/v1/orders?id=eq.${v.order.id}`, { estado: "pagado", notas: "zz-sec hackeado", total: 0.01 }],
      ["DELETE pedido", "DELETE", `/rest/v1/orders?id=eq.${v.order.id}`],
      ["PATCH líneas", "PATCH", `/rest/v1/order_items?order_id=eq.${v.order.id}`, { precio_unitario: 0.01, cantidad: 100 }],
      ["DELETE líneas", "DELETE", `/rest/v1/order_items?order_id=eq.${v.order.id}`],
      ["PATCH comprobante", "PATCH", `/rest/v1/payment_proofs?id=eq.${v.order.proofId}`, { estado: "aprobado" }],
      ["DELETE comprobante", "DELETE", `/rest/v1/payment_proofs?id=eq.${v.order.proofId}`],
      ["PATCH dirección", "PATCH", `/rest/v1/customer_addresses?id=eq.${v.addrId}`, { ciudad: "zz-sec-hackeada" }],
      ["DELETE dirección", "DELETE", `/rest/v1/customer_addresses?id=eq.${v.addrId}`],
      ["PATCH carrito", "PATCH", `/rest/v1/cart_items?user_id=eq.${c2.userId}`, { cantidad: 1 }],
      ["DELETE carrito", "DELETE", `/rest/v1/cart_items?user_id=eq.${c2.userId}`],
      ["PATCH perfil", "PATCH", `/rest/v1/profiles?id=eq.${c2.userId}`, { full_name: "zz-sec hackeado", phone: "0999999999" }],
      ["DELETE perfil", "DELETE", `/rest/v1/profiles?id=eq.${c2.userId}`],
    ];
    for (const [label, method, path, body] of writes) {
      const r = await asC1(method, path, body);
      check(assert, "A1", label, "rechazado / 0 filas", `${r.status}${Array.isArray(r.json) ? ` (${r.json.length} filas)` : ""}`, writeDenied(r));
    }
    // Comprobación independiente (service_role): lo del cliente 2 sigue exactamente igual.
    const after = await orderRow(v.order.id);
    check(assert, "A1", "el pedido del cliente 2 quedó intacto", "mismo estado, total y notas", `${after?.estado}/${after?.total}`, after && after.estado === v.before.estado && after.total === v.before.total && after.notas === v.before.notas);
    const addr = await svc("GET", `/rest/v1/customer_addresses?id=eq.${v.addrId}&select=ciudad`);
    check(assert, "A1", "la dirección del cliente 2 quedó intacta", "ciudad original", addr.json?.[0]?.ciudad ?? "(borrada)", addr.json?.[0]?.ciudad === "Guayaquil");
    const cart = await svc("GET", `/rest/v1/cart_items?user_id=eq.${c2.userId}&select=cantidad`);
    check(assert, "A1", "el carrito del cliente 2 quedó intacto", "cantidad 3", cart.json?.[0]?.cantidad ?? "(vacío)", cart.json?.[0]?.cantidad === 3);
    const p = await profileOf(c2.userId);
    check(assert, "A1", "el perfil del cliente 2 quedó intacto", "mismo nombre", p?.full_name ?? "(vacío)", p && p.full_name === v.profile.full_name && p.phone === v.profile.phone);
  });

  test("Storage: leer, listar, subir, copiar, mover, firmar o borrar archivos del cliente 2", async () => {
    const proof = v.order.proofPath;
    const hdr = { Authorization: `Bearer ${c1.token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    const attempts = [
      ["leer por ruta", "GET", `/storage/v1/object/authenticated/payment-proofs/${proof}`],
      ["leer por ruta directa", "GET", `/storage/v1/object/payment-proofs/${proof}`],
      ["URL pública", "GET", `/storage/v1/object/public/payment-proofs/${proof}`],
      ["info del objeto", "GET", `/storage/v1/object/info/payment-proofs/${proof}`],
      ["listar la carpeta del cliente 2", "POST", "/storage/v1/object/list/payment-proofs", { prefix: c2.userId, limit: 50 }],
      ["listar todo", "POST", "/storage/v1/object/list/payment-proofs", { prefix: "", limit: 50 }],
      ["firmar su ruta", "POST", `/storage/v1/object/sign/payment-proofs/${proof}`, { expiresIn: 3600 }],
      ["subir a su carpeta", "POST", `/storage/v1/object/payment-proofs/${c2.userId}/${PREFIX}intruso.jpg`, "bytes"],
      ["subir a su propia carpeta", "POST", `/storage/v1/object/payment-proofs/${c1.userId}/${PREFIX}propio.jpg`, "bytes"],
      ["sobrescribir su comprobante", "POST", `/storage/v1/object/payment-proofs/${proof}`, "bytes", { "x-upsert": "true" }],
      ["copiarlo a su carpeta", "POST", "/storage/v1/object/copy", { bucketId: "payment-proofs", sourceKey: proof, destinationKey: `${c1.userId}/${PREFIX}copia.jpg` }],
      ["moverlo", "POST", "/storage/v1/object/move", { bucketId: "payment-proofs", sourceKey: proof, destinationKey: `${c1.userId}/${PREFIX}movido.jpg` }],
      ["borrarlo", "DELETE", `/storage/v1/object/payment-proofs/${proof}`],
      ["subir a imágenes de productos", "POST", `/storage/v1/object/product-images/${PREFIX}intruso.jpg`, "bytes"],
    ];
    for (const [label, method, path, body, extra] of attempts) {
      const isBytes = body === "bytes";
      const res = await fetch(SUPABASE_URL + path, {
        method,
        headers: { ...hdr, "Content-Type": isBytes ? "image/jpeg" : "application/json", ...(extra ?? {}) },
        body: body === undefined ? undefined : isBytes ? Buffer.from([0xff, 0xd8, 0xff, 0xe0]) : JSON.stringify(body),
      });
      const text = await res.text();
      const signed = /"signedURL":"[^"]+/.test(text) || /"signedUrl":"[^"]+/.test(text);
      const listed = label.startsWith("listar") && res.status < 300 && /comprobante|zz-sec/.test(text) && text.length > 2;
      check(assert, "A1", `Storage: ${label}`, "rechazado, vacío o sin URL firmada", `${res.status}${signed ? " (URL FIRMADA)" : ""}${listed ? " (lista archivos)" : ""}`, (res.status >= 400 || text === "[]" || text === "") && !signed && !listed);
    }
    const intact = await fetch(`${SUPABASE_URL}/storage/v1/object/payment-proofs/${proof}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    check(assert, "A1", "el comprobante del cliente 2 sigue en su sitio", "200", intact.status, intact.status === 200);
  });

  test("por la app: el cliente 1 no puede ver el pedido ni el comprobante del cliente 2", { skip: !up && "no hay servidor" }, async () => {
    const r = await fetch(`${process.env.ATTACK_APP_URL || "http://localhost:3101"}/confirmacion/${v.order.referencia}`, { headers: { Cookie: c1.cookie }, redirect: "manual" });
    const html = await r.text();
    check(assert, "A1", "GET /confirmacion/<referencia del cliente 2> con la sesión del cliente 1", "sin datos del pedido", `${r.status}${/Monto exacto|Cuentas para transferir/.test(html) ? " (MUESTRA EL PEDIDO)" : ""}`, !/Monto exacto|Cuentas para transferir/.test(html));
    const sub = await callAction("subirComprobante", [v.order.referencia, (() => { const f = new FormData(); f.set("archivo", new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "x.jpg", { type: "image/jpeg" })); return f; })()], { cookie: c1.cookie });
    check(assert, "A1", "subirComprobante a la referencia del cliente 2", "No encontramos ese pedido", JSON.stringify(sub.value).slice(0, 80), sub.value?.ok !== true && /No encontramos/.test(sub.value?.error ?? ""));
  });
});

describe("A2. subirse el rol o escribir en columnas protegidas", opts, () => {
  test("profiles: role, constancia de términos, id", async () => {
    for (const [label, body] of [
      ["role = admin", { role: "admin" }],
      ["role = admin junto con nombre", { role: "admin", full_name: "zz-sec admin" }],
      ["terminos_aceptados_en", { terminos_aceptados_en: "2020-01-01T00:00:00Z" }],
      ["terminos_version", { terminos_version: "zz-sec-falsa" }],
      ["id (suplantar a otro)", { id: c2.userId }],
    ]) {
      const r = await asC1("PATCH", `/rest/v1/profiles?id=eq.${c1.userId}`, body);
      check(assert, "A2", `PATCH profiles ${label}`, "rechazado", `${r.status}`, writeDenied(r));
    }
    const p = await profileOf(c1.userId);
    check(assert, "A2", "el rol del cliente 1 sigue siendo customer", "customer", p?.role, p?.role === "customer");
    check(assert, "A2", "la constancia de términos no cambió", "igual", `${p?.terminos_version}`, p?.terminos_version === v.c1profile.terminos_version && p?.terminos_aceptados_en === v.c1profile.terminos_aceptados_en);
    const ins = await asC1("POST", "/rest/v1/profiles", { id: c1.userId, role: "admin" });
    check(assert, "A2", "insertar un perfil admin", "rechazado", ins.status, writeDenied(ins));
  });

  test("metadatos del usuario (user_metadata) no dan rol: el perfil sigue siendo customer", async () => {
    const put = async (data) => fetch(`${SUPABASE_URL}/auth/v1/user`, { method: "PUT", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${c1.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    const r = await put({ role: "admin", terminos_version: "zz-sec-falsa", is_admin: true });
    const admin = await asC1("GET", `/rest/v1/profiles?id=eq.${c1.userId}&select=role`);
    check(assert, "A2", "user_metadata {role: admin}", "el perfil sigue siendo customer", `${r.status}, rol=${admin.json?.[0]?.role}`, admin.json?.[0]?.role === "customer");
    // El panel exige is_admin() (perfil en la base + aal2), no metadatos: sin acceso a las funciones admin.
    const rpc = await asC1("POST", "/rest/v1/rpc/admin_dashboard_summary", {});
    check(assert, "A2", "con user_metadata {role: admin}, admin_dashboard_summary", "rechazado", rpc.status, rpc.status >= 400);
    await put({ role: null, terminos_version: null, is_admin: null }); // se restablece la cuenta de prueba
  });

  test("cambiar user_id de un recurso propio o crear recursos a nombre de otro", async () => {
    const attempts = [
      ["dirección propia → user_id del cliente 2", "PATCH", `/rest/v1/customer_addresses?user_id=eq.${c1.userId}`, { user_id: c2.userId }],
      ["crear dirección a nombre del cliente 2", "POST", "/rest/v1/customer_addresses", { user_id: c2.userId, etiqueta: "zz-sec", destinatario: "x", telefono: "0991234567", provincia: "Guayas", ciudad: "Guayaquil", direccion: "zz-sec calle 1", es_predeterminada: false }],
      ["poner un producto en el carrito del cliente 2", "POST", "/rest/v1/cart_items", { user_id: c2.userId, product_id: v.product.id, cantidad: 1 }],
      ["pedido propio → user_id del cliente 2", "PATCH", `/rest/v1/orders?id=eq.${v.own.id}`, { user_id: c2.userId }],
      ["comprobante propio → otro pedido", "PATCH", `/rest/v1/payment_proofs?id=eq.${v.own.proofId}`, { order_id: v.order.id }],
    ];
    for (const [label, method, path, body] of attempts) {
      const r = await asC1(method, path, body);
      check(assert, "A2", label, "rechazado", `${r.status}`, writeDenied(r));
    }
    const cart = await svc("GET", `/rest/v1/cart_items?user_id=eq.${c2.userId}&select=cantidad`);
    check(assert, "A2", "el carrito del cliente 2 sigue con 3 unidades", "3", cart.json?.[0]?.cantidad, cart.json?.[0]?.cantidad === 3);
  });

  test("precios: cambiar el precio de un producto o de una línea de pedido", async () => {
    for (const [label, method, path, body] of [
      ["precio del producto", "PATCH", `/rest/v1/products?id=eq.${v.product.id}`, { precio: 0.01 }],
      ["stock del producto", "PATCH", `/rest/v1/products?id=eq.${v.product.id}`, { stock: 99999, stock_reservado: 0 }],
      ["línea de su propio pedido", "PATCH", `/rest/v1/order_items?order_id=eq.${v.own.id}`, { precio_unitario: 0.01 }],
      ["total de su propio pedido", "PATCH", `/rest/v1/orders?id=eq.${v.own.id}`, { subtotal: 0.01, total: 0.01 }],
    ]) {
      const r = await asC1(method, path, body);
      check(assert, "A2", label, "rechazado", r.status, writeDenied(r));
    }
    const p = await getProduct(v.product.id);
    check(assert, "A2", "el producto conserva precio y stock", "10 / 30", `${p.precio} / ${p.stock}`, Number(p.precio) === 10 && p.stock === 30);
  });
});

describe("A3. el cliente 1 contra SU PROPIO pedido (estado, pago y notas)", opts, () => {
  test("no puede marcarlo pagado, enviado o entregado, ni cambiar fechas, notas o plazo", async () => {
    const tries = [
      ["estado = pagado", { estado: "pagado" }],
      ["estado = enviado", { estado: "enviado" }],
      ["estado = entregado", { estado: "entregado" }],
      ["estado = cancelado", { estado: "cancelado" }],
      ["pagado_en", { pagado_en: "2020-01-01T00:00:00Z" }],
      ["enviado_en", { enviado_en: "2020-01-01T00:00:00Z" }],
      ["notas del administrador", { notas: "zz-sec: pago verificado" }],
      ["motivo_estado", { motivo_estado: "zz-sec" }],
      ["vence_en (alargar el plazo)", { vence_en: "2099-01-01T00:00:00Z" }],
      ["referencia", { referencia: "MC-AAAAAAAA" }],
      ["reserva_activa", { reserva_activa: false }],
      ["terminos_aceptados_en", { terminos_aceptados_en: "2020-01-01T00:00:00Z" }],
      ["terminos_version", { terminos_version: "zz-sec" }],
      ["contacto_email", { contacto_email: "zz-sec@example.com" }],
    ];
    for (const [label, body] of tries) {
      const r = await asC1("PATCH", `/rest/v1/orders?id=eq.${v.own.id}`, body);
      check(assert, "A3", `PATCH orders ${label}`, "rechazado / 0 filas", `${r.status}`, writeDenied(r));
    }
    const after = await orderRow(v.own.id);
    for (const k of ["estado", "pagado_en", "enviado_en", "notas", "vence_en", "referencia", "total", "reserva_activa", "terminos_version"]) {
      check(assert, "A3", `orders.${k} no cambió`, "igual", String(after?.[k]), String(after?.[k]) === String(v.ownBefore[k]));
    }
  });
  test("no puede aprobar, rechazar o borrar su propio comprobante, ni borrar su pedido", async () => {
    for (const [label, method, path, body] of [
      ["aprobar el comprobante", "PATCH", `/rest/v1/payment_proofs?id=eq.${v.own.proofId}`, { estado: "aprobado", revisado_por: c1.userId }],
      ["rechazar el comprobante", "PATCH", `/rest/v1/payment_proofs?id=eq.${v.own.proofId}`, { estado: "rechazado", motivo: "zz-sec" }],
      ["cambiar el archivo del comprobante", "PATCH", `/rest/v1/payment_proofs?id=eq.${v.own.proofId}`, { archivo: "zz-sec/otro.jpg", hash: "a".repeat(64) }],
      ["borrar el comprobante", "DELETE", `/rest/v1/payment_proofs?id=eq.${v.own.proofId}`],
      ["insertar un comprobante aprobado", "POST", "/rest/v1/payment_proofs", { order_id: v.own.id, archivo: "zz-sec/x.jpg", hash: "b".repeat(64), estado: "aprobado" }],
      ["borrar el pedido", "DELETE", `/rest/v1/orders?id=eq.${v.own.id}`],
      ["agregar una línea gratis", "POST", "/rest/v1/order_items", { order_id: v.own.id, nombre: "zz-sec-gratis", precio_unitario: 0, cantidad: 1 }],
      ["borrar sus líneas", "DELETE", `/rest/v1/order_items?order_id=eq.${v.own.id}`],
    ]) {
      const r = await asC1(method, path, body);
      check(assert, "A3", label, "rechazado / 0 filas", `${r.status}`, writeDenied(r));
    }
    const proof = await svc("GET", `/rest/v1/payment_proofs?id=eq.${v.own.proofId}&select=estado,archivo`);
    check(assert, "A3", "su comprobante sigue en revisión", "en_revision", proof.json?.[0]?.estado ?? "(borrado)", proof.json?.[0]?.estado === "en_revision");
  });
});

describe("A4. crear un pedido con la dirección o el carrito de otra persona (por la app)", { skip: skip || (!up && "no hay servidor") }, () => {
  test("dirección del cliente 2 con la sesión del cliente 1", async () => {
    await clearTestCart(c1.userId);
    await setCart(c1.userId, [{ productId: v.product.id, cantidad: 1 }]);
    const countBefore = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&select=id`)).json?.length;
    const r = await callAction("crearPedido", [{ nombre: "zz-sec Cliente", telefono: "0991234567", addressId: v.addrId, acepta: true }], { cookie: c1.cookie });
    const countAfter = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&select=id`)).json?.length;
    check(assert, "A4", "crearPedido con addressId de otro usuario", "rechazado, sin pedido nuevo", `${r.value?.ok ? "CREADO" : r.value?.error}; pedidos ${countBefore}→${countAfter}`, r.value?.ok !== true && countAfter === countBefore);
  });
  test("campos inyectados: user_id, precios, totales, descuentos, envío y cupón se rechazan", async () => {
    await setCart(c1.userId, [{ productId: v.product.id, cantidad: 1 }]);
    const countBefore = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&select=id`)).json?.length;
    const injected = [
      { user_id: c2.userId }, { total: 0.01 }, { subtotal: 0.01 }, { envio: 0 }, { descuento: 999 }, { descuento_transferencia: 50 },
      { precio: 0.01 }, { items: [{ product_id: v.product.id, precio_unitario: 0.01, cantidad: 1 }] }, { cupon: "GRATIS100" }, { codigo: "GRATIS100" }, { estado: "pagado" },
    ];
    for (const extra of injected) {
      const r = await callAction("crearPedido", [{ ...CHECKOUT_OK, ...extra }], { cookie: c1.cookie });
      check(assert, "A4", `crearPedido + ${Object.keys(extra)[0]}`, "rechazado (esquema estricto)", `${r.value?.ok ? "CREADO" : (r.value?.error ?? "?").slice(0, 40)}`, r.value?.ok !== true);
    }
    const countAfter = (await svc("GET", `/rest/v1/orders?user_id=eq.${c1.userId}&select=id`)).json?.length;
    check(assert, "A4", "no se creó ningún pedido con campos inyectados", "sin cambios", `${countBefore}→${countAfter}`, countAfter === countBefore);
  });
  test("las acciones del carrito con el id de otro usuario devuelven SOLO el carrito propio", async () => {
    const r = await callAction("obtenerCarrito", [c2.userId], { cookie: c1.cookie });
    const leaked = JSON.stringify(r.value).includes(v.product.id) && r.value?.userId === c2.userId;
    check(assert, "A4", "obtenerCarrito(id del cliente 2) con sesión del cliente 1", "code=session y carrito propio", JSON.stringify(r.value).slice(0, 90), !leaked && r.value?.code === "session" && r.value?.userId === c1.userId);
    const w = await callAction("agregarLinea", [c2.userId, v.product.id, 1], { cookie: c1.cookie });
    const cart2 = await svc("GET", `/rest/v1/cart_items?user_id=eq.${c2.userId}&select=cantidad`);
    check(assert, "A4", "agregarLinea en nombre del cliente 2", "no toca su carrito", `${JSON.stringify(w.value).slice(0, 50)}; carrito 2 = ${cart2.json?.[0]?.cantidad}`, cart2.json?.[0]?.cantidad === 3);
    const d = await callAction("vaciarCarrito", [c2.userId], { cookie: c1.cookie });
    const cart3 = await svc("GET", `/rest/v1/cart_items?user_id=eq.${c2.userId}&select=cantidad`);
    check(assert, "A4", "vaciarCarrito en nombre del cliente 2", "no toca su carrito", `${JSON.stringify(d.value).slice(0, 50)}; carrito 2 = ${cart3.json?.[0]?.cantidad}`, cart3.json?.[0]?.cantidad === 3);
  });
});

describe("A5. tablas internas", opts, () => {
  test("contact_messages, email_log, rate_limits, store_settings y las funciones de servidor: ni el cliente 1 ni el 2", async () => {
    for (const [who, s] of [["cliente 1", c1], ["cliente 2", c2]]) {
      for (const t of ["contact_messages", "email_log", "rate_limits", "store_settings"]) {
        const r = await rest("GET", `/rest/v1/${t}?select=*&limit=5`, { token: s.token });
        check(assert, "A5", `${who} lee ${t}`, "sin filas", `${r.status}${Array.isArray(r.json) ? ` (${r.json.length})` : ""}`, !gotRows(r));
      }
      const pub = await rest("GET", `/rest/v1/store_public_info?select=cuentas_bancarias,costo_envio,horas_limite_pago`, { token: s.token });
      check(assert, "A5", `${who} lee cuentas bancarias por la vista pública`, "error", pub.status, pub.status >= 400);
      for (const fn of ["rate_limit_hit", "create_order", "submit_payment_proof", "create_contact_message", "email_log_claim", "record_order_terms", "expire_orders", "cleanup_rate_limits"]) {
        const r = await rest("POST", `/rest/v1/rpc/${fn}`, { token: s.token, body: {} });
        check(assert, "A5", `${who} ejecuta ${fn}`, "rechazado", r.status, r.status >= 400);
      }
    }
  });
});

import { after } from "node:test";
after(async () => {
  if (skip) return;
  // Se libera lo que reservaron los pedidos de prueba (vía normal: vencer) y se quitan del carrito los productos de prueba.
  await expirePending([c1.userId, c2.userId]);
  await clearTestCart(c1.userId);
  await clearTestCart(c2.userId);
});
