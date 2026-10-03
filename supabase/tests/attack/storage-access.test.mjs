// D17. Acceso a archivos de Storage. Los archivos de prueba se suben con service_role (preparación) a rutas
// "zz-sec-…" y se atacan con el token anon. Todo ataque debe fallar. Sin llaves en el código.
import assert from "node:assert/strict";
import https from "node:https";
import { describe, test } from "node:test";
import { ANON, PREFIX, SERVICE, SUPABASE_URL, assertDevOnly, check, haveService, haveSupabase, installSummary, rec, sleep } from "./lib.mjs";

installSummary("D17. Storage");
const opts = { skip: (!haveSupabase || !haveService) && "faltan las variables de Supabase o service_role" };
if (haveSupabase) assertDevOnly();

const run = Date.now().toString(36);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("<html><script>alert(1)</script></html>")]);
// El comprobante lleva una marca propia: si una respuesta la contiene, se leyó el comprobante de verdad.
const PROOF_MARK = "zz-sec-PROOF-MARKER";
const PROOF = Buffer.concat([JPEG, Buffer.from(PROOF_MARK)]);

/** Petición con la ruta EXACTA (fetch normaliza los `..` y `%2e%2e` antes de enviar y ocultaría el ataque). */
function rawReq(method, pathStr, { key = ANON, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL);
    const rq = https.request({ host: u.host, path: pathStr, method, headers: { apikey: key, Authorization: `Bearer ${key}` } }, (r) => {
      const chunks = [];
      r.on("data", (d) => chunks.push(d));
      r.on("end", () => resolve({ status: r.statusCode, body: Buffer.concat(chunks) }));
    });
    rq.on("error", reject);
    if (body) rq.write(body);
    rq.end();
  });
}

const raw = (method, path, { key = ANON, body, headers = {} } = {}) =>
  fetch(`${SUPABASE_URL}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers }, body, redirect: "manual" });

async function upload(bucket, path, bytes, contentType) {
  const r = await raw("POST", `/storage/v1/object/${bucket}/${path}`, { key: SERVICE, body: bytes, headers: { "Content-Type": contentType, "x-upsert": "true" } });
  if (r.status >= 300) throw new Error(`no se pudo subir el archivo de prueba a ${bucket}: ${r.status} ${await r.text()}`);
}

const proofPath = `${PREFIX}${run}/comprobante.jpg`;
const imagePath = `${PREFIX}${run}/polyglot.jpg`;

describe("D17. archivos de comprobantes (bucket privado)", opts, () => {
  test("preparación: archivo de prueba en payment-proofs", async () => {
    await upload("payment-proofs", proofPath, PROOF, "image/jpeg");
    await upload("product-images", imagePath, JPEG, "image/jpeg");
  });

  test("anon: no lee el comprobante por la URL pública, la autenticada ni la firmada ajena", async () => {
    for (const [label, url] of [
      ["URL pública", `/storage/v1/object/public/payment-proofs/${proofPath}`],
      ["URL autenticada con anon", `/storage/v1/object/authenticated/payment-proofs/${proofPath}`],
      ["ruta directa", `/storage/v1/object/payment-proofs/${proofPath}`],
      ["info del objeto", `/storage/v1/object/info/payment-proofs/${proofPath}`],
    ]) {
      const r = await raw("GET", url);
      check(assert, "D17", `anon lee comprobante: ${label}`, "rechazado", r.status, r.status >= 400);
    }
  });

  test("anon: no puede crear una URL firmada, ni listar, ni mover, copiar o borrar", async () => {
    const attempts = [
      ["firmar", "POST", `/storage/v1/object/sign/payment-proofs/${proofPath}`, JSON.stringify({ expiresIn: 3600 })],
      ["firmar varias", "POST", `/storage/v1/object/sign/payment-proofs`, JSON.stringify({ expiresIn: 3600, paths: [proofPath] })],
      ["listar", "POST", `/storage/v1/object/list/payment-proofs`, JSON.stringify({ prefix: "", limit: 50 })],
      ["listar la carpeta", "POST", `/storage/v1/object/list/payment-proofs`, JSON.stringify({ prefix: `${PREFIX}${run}`, limit: 50 })],
      ["borrar", "DELETE", `/storage/v1/object/payment-proofs/${proofPath}`, undefined],
      ["mover", "POST", `/storage/v1/object/move`, JSON.stringify({ bucketId: "payment-proofs", sourceKey: proofPath, destinationKey: `${PREFIX}${run}/robado.jpg` })],
      ["copiar", "POST", `/storage/v1/object/copy`, JSON.stringify({ bucketId: "payment-proofs", sourceKey: proofPath, destinationKey: `${PREFIX}${run}/copia.jpg` })],
      ["subir", "POST", `/storage/v1/object/payment-proofs/${PREFIX}${run}/anon.jpg`, JPEG],
      ["sobrescribir", "POST", `/storage/v1/object/payment-proofs/${proofPath}`, JPEG, { "x-upsert": "true" }],
    ];
    for (const [label, method, path, body, extra] of attempts) {
      const r = await raw(method, path, { body, headers: { "Content-Type": body && typeof body === "string" ? "application/json" : "image/jpeg", ...(extra ?? {}) } });
      const text = await r.text();
      const leaked = label.startsWith("listar") && /comprobante\.jpg/.test(text) && r.status < 300;
      // "firmar varias" responde 200 con un error por ruta: lo que importa es que NINGUNA traiga signedURL.
      const signed = /"signedURL":"[^"]+/.test(text) || /"signedUrl":"[^"]+/.test(text);
      check(assert, "D17", `anon ${label} en payment-proofs`, "rechazado, vacío o sin URL firmada", `${r.status}${leaked ? " (lista el archivo)" : ""}${signed ? " (DEVUELVE URL FIRMADA)" : ""}`, (r.status >= 400 || text === "[]" || text.trim() === "" || label === "firmar varias") && !leaked && !signed);
    }
    // El archivo sigue intacto tras los intentos de sobrescribir y borrar.
    const intact = await raw("GET", `/storage/v1/object/payment-proofs/${proofPath}`, { key: SERVICE });
    check(assert, "D17", "el archivo sigue igual tras los ataques", "intacto", intact.status, intact.status === 200 && (await intact.arrayBuffer()).byteLength === PROOF.length);
  });

  test("URLs firmadas: vencidas, con la firma cambiada o usadas en otra ruta", async () => {
    const sign = async (path, sec) => {
      const r = await raw("POST", `/storage/v1/object/sign/payment-proofs/${path}`, { key: SERVICE, body: JSON.stringify({ expiresIn: sec }), headers: { "Content-Type": "application/json" } });
      const j = await r.json();
      return j.signedURL ?? j.signedUrl;
    };
    const full = (u) => (u.startsWith("http") ? u : `${SUPABASE_URL}/storage/v1${u.startsWith("/") ? "" : "/"}${u}`);
    // Vigente: funciona (control positivo). Y se puede reutilizar mientras no venza (es un secreto al portador).
    const valid = await sign(proofPath, 120);
    assert.ok(valid, "no se pudo firmar");
    const ok1 = await fetch(full(valid));
    const ok2 = await fetch(full(valid));
    check(assert, "D17", "control positivo: la URL firmada vigente abre el archivo", "200", ok1.status, ok1.status === 200);
    rec("D17", "reutilizar una URL firmada vigente", "informativo: vale hasta vencer (5 min en la app)", `${ok2.status}`, "ok");
    // Vencida
    const shortLived = await sign(proofPath, 1);
    await sleep(3500);
    const expired = await fetch(full(shortLived));
    check(assert, "D17", "URL firmada vencida", "rechazada", expired.status, expired.status >= 400);
    // Firma cambiada
    const tampered = full(valid).replace(/token=([^&]+)/, (_, t) => `token=${t.slice(0, -4)}AAAA`);
    const t1 = await fetch(tampered);
    check(assert, "D17", "token de la URL firmada alterado", "rechazado", t1.status, t1.status >= 400);
    // Token válido para otra ruta
    const other = full(valid).replace(encodeURIComponent(proofPath), `${PREFIX}${run}/otro.jpg`).replace(proofPath, `${PREFIX}${run}/otro.jpg`);
    const t2 = await fetch(other);
    check(assert, "D17", "token de un archivo usado en otra ruta", "rechazado", t2.status, t2.status >= 400);
    // Sin token
    const t3 = await fetch(full(valid).replace(/\?token=.*/, ""));
    check(assert, "D17", "URL firmada sin token", "rechazado", t3.status, t3.status >= 400);
  });

  test("recorrido de rutas y rutas adivinadas (ruta exacta, sin normalizar)", async () => {
    const paths = [
      `/storage/v1/object/payment-proofs/../payment-proofs/${proofPath}`,
      `/storage/v1/object/public/payment-proofs/../payment-proofs/${proofPath}`,
      `/storage/v1/object/public/product-images/../payment-proofs/${proofPath}`,
      `/storage/v1/object/public/product-images/%2e%2e/payment-proofs/${proofPath}`,
      `/storage/v1/object/public/product-images/..%2fpayment-proofs%2f${encodeURIComponent(proofPath)}`,
      `/storage/v1/object/public/product-images/..%5cpayment-proofs%5c${encodeURIComponent(proofPath)}`,
      `/storage/v1/object/public/product-images/%252e%252e/payment-proofs/${proofPath}`,
      `/storage/v1/object/authenticated/payment-proofs/${proofPath}%00.png`,
      `/storage/v1/object/public/payment-proofs/${proofPath}`,
      `/storage/v1/object/payment-proofs/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000/x.jpg`,
      `/storage/v1/object/payment-proofs/${"a/".repeat(200)}x.jpg`,
    ];
    for (const p of paths) {
      const r = await rawReq("GET", p);
      const leaked = r.status < 300 && r.body.includes(PROOF_MARK);
      check(assert, "D17", `GET ${p.slice(0, 90)}`, "no entrega el comprobante", `${r.status}${leaked ? " (ENTREGA EL COMPROBANTE)" : ""}`, !leaked);
    }
  });

  test("anon y un token inventado no listan los buckets ni ven su configuración", async () => {
    for (const [label, key] of [["anon", ANON], ["token inventado", "eyJhbGciOiJIUzI1NiJ9.e30.zz-sec"]]) {
      const r = await raw("GET", "/storage/v1/bucket", { key: ANON, headers: { Authorization: `Bearer ${key}` } });
      const j = await r.json().catch(() => null);
      rec("D17", `${label} lista buckets`, "informativo: listar no da acceso a los archivos", `${r.status}${Array.isArray(j) ? ` (${j.length} buckets)` : ""}`, "ok");
      const make = await raw("POST", "/storage/v1/bucket", { headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ name: `${PREFIX}${run}-${label.length}`, public: true }) });
      check(assert, "D17", `${label}: crear un bucket`, "rechazado", make.status, make.status >= 400);
    }
    const create = await raw("POST", "/storage/v1/bucket", { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `${PREFIX}${run}-bucket`, public: true }) });
    check(assert, "D17", "anon crea un bucket público", "rechazado", create.status, create.status >= 400);
    const empty = await raw("POST", `/storage/v1/bucket/payment-proofs/empty`, { headers: { "Content-Type": "application/json" } });
    check(assert, "D17", "anon vacía el bucket de comprobantes", "rechazado", empty.status, empty.status >= 400);
    const del = await raw("DELETE", `/storage/v1/bucket/payment-proofs`);
    check(assert, "D17", "anon borra el bucket de comprobantes", "rechazado", del.status, del.status >= 400);
  });

  test("configuración de los buckets (informe): visibilidad, tamaño máximo y tipos permitidos", async () => {
    for (const name of ["payment-proofs", "product-images"]) {
      const r = await raw("GET", `/storage/v1/bucket/${name}`, { key: SERVICE });
      const b = await r.json();
      rec("D17", `bucket ${name}`, name === "payment-proofs" ? "privado" : "público solo lectura", `public=${b.public}, límite=${b.file_size_limit ?? "sin límite"}, tipos=${(b.allowed_mime_types ?? ["cualquiera"]).join(",")}`, name === "payment-proofs" && b.public ? "FALLÓ" : "ok");
      if (name === "payment-proofs") assert.equal(b.public, false, "el bucket de comprobantes debe ser privado");
    }
    // ¿El bucket rechaza por sí mismo un tipo peligroso? (defensa en profundidad, además de la app)
    const html = await raw("POST", `/storage/v1/object/payment-proofs/${PREFIX}${run}/malo.html`, { key: SERVICE, body: "<script>alert(1)</script>", headers: { "Content-Type": "text/html", "x-upsert": "true" } });
    rec("D17", "subir text/html al bucket de comprobantes con service_role (solo la app lo puede hacer)", "informativo: la app ya filtra por bytes; el bucket no limita tipos", `${html.status}`, html.status < 300 ? "hallazgo" : "ok");
  });
});

describe("D16/D17. cómo se sirve un archivo publicado en product-images (polyglot)", opts, () => {
  test("una imagen con HTML dentro se sirve como imagen y con nosniff", async () => {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/public/product-images/${imagePath}`);
    const ct = r.headers.get("content-type") ?? "";
    const nosniff = r.headers.get("x-content-type-options") ?? "";
    const csp = r.headers.get("content-security-policy") ?? "";
    check(assert, "D16", "polyglot JPEG+HTML servido por Supabase", "content-type de imagen (no text/html)", ct, /^image\/jpeg/.test(ct));
    rec("D16", "cabeceras del archivo público", "nosniff y/o CSP restrictiva", `nosniff=${nosniff || "no"}, csp=${csp ? "sí" : "no"}`, nosniff || csp ? "ok" : "hallazgo");
    // Y desde otro origen que el de la tienda (dominio de Supabase), así que un script ahí no toca la sesión de la tienda.
    check(assert, "D16", "el archivo no se sirve desde el origen de la tienda", "dominio distinto", new URL(`${SUPABASE_URL}`).host, new URL(SUPABASE_URL).host !== new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
  });
});
