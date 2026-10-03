// D16. Subida de comprobantes POR LA APP (acción subirComprobante) con archivos hostiles. Solo deben aceptarse
// imágenes JPG/PNG o PDF reales de hasta 4 MB; el nombre y el tipo declarado no cuentan y la ruta en el bucket
// la genera el servidor. Cuentas: cliente 1 y 2 (ATTACK_CUSTOMER_*). Los pedidos y archivos son de prueba (zz-sec-).
// Límite honesto: el servidor permite 10 subidas por hora y usuario; esta prueba usa 10 (cliente 1) y 3 (cliente 2).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { NO_ACCOUNTS, PREFIX, SERVICE, SUPABASE_URL, appUp, assertDevOnly, callAction, check, clearTestCart, ensureProduct, expirePending, haveService, installSummary, makeOrder, rec, svc, trySession } from "./lib.mjs";

installSummary("D16. Subida de archivos hostiles (comprobantes)");
const c1 = await trySession("c1");
const c2 = await trySession("c2");
const up = await appUp();
const skip = (!c1 || !c2 || !haveService || !up) && (!up ? "no hay servidor local" : NO_ACCOUNTS);
if (!skip) assertDevOnly();

const enc = (s) => Buffer.from(s);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const send = (session, ref, bytes, name, type) => {
  const f = new FormData();
  f.set("archivo", new File([bytes], name, { type }));
  return callAction("subirComprobante", [ref, f], { cookie: session.cookie });
};
const limited = (r) => /Demasiados intentos/.test(r.value?.error ?? "");
const proofsOf = async (orderId) => (await svc("GET", `/rest/v1/payment_proofs?order_id=eq.${orderId}&select=id,archivo,estado,created_at&order=created_at`)).json ?? [];
let o1;
let o2;

before(async () => {
  if (skip) return;
  await expirePending([c1.userId, c2.userId]);
  const id = await ensureProduct("d16", { nombre: `${PREFIX}d16`, precio: 10, stock: 50 });
  const product = { id, nombre: `${PREFIX}d16`, precio: 10 };
  o1 = await makeOrder(c1, product);
  o2 = await makeOrder(c2, product);
});
after(async () => {
  if (skip) return;
  await expirePending([c1.userId, c2.userId]);
  await clearTestCart(c1.userId);
  await clearTestCart(c2.userId);
});

describe("D16. archivos que deben RECHAZARSE", { skip }, () => {
  test("vacío, de más de 4 MB, ejecutable, HTML, SVG, GIF y tipo mentido", async () => {
    const big = Buffer.alloc(4 * 1024 * 1024 + 1);
    JPEG.copy(big);
    const cases = [
      ["archivo vacío", Buffer.alloc(0), "vacio.jpg", "image/jpeg"],
      ["4 MB + 1 byte", big, "grande.jpg", "image/jpeg"],
      ["ejecutable .exe renombrado .jpg", Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]), "comprobante.jpg", "image/jpeg"],
      ["HTML con tipo image/jpeg", enc("<html><script>alert(1)</script></html>"), "comprobante.jpg", "image/jpeg"],
      ["SVG con script", enc('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "comprobante.svg", "image/svg+xml"],
      ["GIF (imagen válida, formato no permitido)", Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]), "comprobante.jpg", "image/jpeg"],
      ["tipo mentido: texto con tipo application/pdf", enc("esto no es un pdf"), "comprobante.pdf", "application/pdf"],
    ];
    for (const [label, bytes, name, type] of cases) {
      const r = await send(c1, o1.referencia, bytes, name, type);
      if (limited(r)) {
        rec("D16", label, "rechazado", "bloqueado por el límite de comprobantes (10 por hora y usuario)", "bloqueado");
        continue;
      }
      check(assert, "D16", label, "rechazado", `${r.value?.ok ? "ACEPTADO" : (r.value?.error ?? "?").slice(0, 50)}`, r.value?.ok !== true);
    }
    const proofs = await proofsOf(o1.id);
    check(assert, "D16", "ningún archivo hostil quedó guardado", "0 comprobantes del pedido", proofs.length, proofs.length === 0);
  });
});

describe("D16. archivos que se ACEPTAN: solo por su contenido real, con ruta y nombre generados por el servidor", { skip }, () => {
  test("polyglot, PDF con script y nombres hostiles: se aceptan como imagen o PDF, y el nombre del usuario se descarta", async () => {
    const accepted = [
      [c1, o1, "polyglot JPEG con HTML al final (aceptado por diseño: se sirve como imagen)", Buffer.concat([JPEG, enc("<script>alert(1)</script>")]), "../../etc/passwd.jpg", "image/jpeg", /\.jpg$/],
      [c1, o1, "PDF con JavaScript (aceptado por diseño: se abre en otra pestaña, otro origen)", enc("%PDF-1.4\n1 0 obj<</OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj"), "comprobante.php.jpg", "application/pdf", /\.pdf$/],
      [c1, o1, "PNG real con tipo declarado text/html y doble extensión", Buffer.concat([PNG, enc("zz-sec")]), "comprobante.html.png", "text/html", /\.png$/],
      [c2, o2, "nombre con ../ y barras invertidas", Buffer.concat([JPEG, enc("n1")]), "..\\..\\x/../y.jpg", "image/jpeg", /\.jpg$/],
      [c2, o2, "nombre de 300 caracteres, comillas y CRLF", Buffer.concat([JPEG, enc("n2")]), `${"a".repeat(300)}"'\r\n.jpg`, "image/jpeg", /\.jpg$/],
      [c2, o2, "nombre con unicode, emoji y byte nulo", Buffer.concat([JPEG, enc("n3")]), "compróbánte😀\u0000.jpg", "image/jpeg", /\.jpg$/],
    ];
    const seen = new Map();
    for (const [session, order, label, bytes, name, type, ext] of accepted) {
      const r = await send(session, order.referencia, bytes, name, type);
      if (limited(r)) {
        rec("D16", label, "aceptado con ruta del servidor", "bloqueado por el límite de comprobantes", "bloqueado");
        continue;
      }
      const proofs = await proofsOf(order.id);
      const last = proofs.at(-1);
      const okPath = last && new RegExp(`^${session.userId}/${order.id}/[0-9a-f-]{36}\\.(jpg|png|pdf)$`).test(last.archivo) && ext.test(last.archivo);
      seen.set(label, last?.archivo);
      check(assert, "D16", label, "aceptado; ruta <usuario>/<pedido>/<uuid>.<ext> según el contenido, sin el nombre del archivo", `${r.value?.ok ? "aceptado" : (r.value?.error ?? "?").slice(0, 40)}; ${last?.archivo?.replace(session.userId, "<u>").replace(order.id, "<p>") ?? "-"}`, r.value?.ok === true && Boolean(okPath));
    }
    // El archivo realmente guardado conserva el tipo correcto en el bucket (sirve con el content-type de su contenido).
    for (const [label, path] of seen) {
      if (!path) continue;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/payment-proofs/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
      const ct = res.headers.get("content-type") ?? "";
      check(assert, "D16", `content-type guardado: ${label.slice(0, 40)}`, "image/jpeg, image/png o application/pdf", ct, /^(image\/jpeg|image\/png|application\/pdf)/.test(ct));
      await res.arrayBuffer();
    }
  });
});
