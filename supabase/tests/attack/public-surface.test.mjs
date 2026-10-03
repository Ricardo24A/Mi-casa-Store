// Superficie PÚBLICA (sin sesión): inyecciones, parámetros extraños, enumeración de cuentas, redirecciones,
// CSRF desde otro origen, límites de uso y tamaños. Todo ataque debe fallar. Sin llaves en el código.
// Requiere el servidor con la clave de PRUEBA de Turnstile (serve-test-turnstile.mjs, puerto 3101), porque
// el contacto y el login exigen Turnstile (en `npm run start` sin clave se rechaza: se prueba aparte).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { APP_STRICT_URL, APP_URL, PREFIX, appUp, assertDevOnly, callAction, check, form, getPage, haveService, installSummary, randomIp, rec } from "./lib.mjs";

installSummary("Superficie pública (E, F, G)");
const up = await appUp();
const upStrict = await appUp(APP_STRICT_URL);
const opts = { skip: !up && `no hay servidor en ${APP_URL}` };
if (up) assertDevOnly();

const run = Date.now().toString(36);
const TURN = "XXXX.DUMMY.TOKEN.XXXX";
const LEAK_SQL = /syntax error|PGRST|SQLSTATE|violates|relation "|column "|stack trace|at \S+ \(/i;

function contactForm({ email, nombre = `${PREFIX}ataque`, mensaje = `${PREFIX}mensaje de prueba de seguridad`, asunto = "", telefono = "0991234567", extra = {} } = {}) {
  return form({ nombre, email, telefono, asunto, mensaje, acepta: "on", sitio_web: "", "cf-turnstile-response": TURN, ...extra });
}
const send = (fd, o = {}) => callAction("enviarMensaje", [{}, fd], o);
// service_role NO puede leer contact_messages (a propósito), así que "¿se guardó?" se mide con el límite de
// 3 mensajes por correo y hora: si aceptan los 3 de la sonda, no había ninguno guardado antes con ese correo.
async function storedBefore(email) {
  let accepted = 0;
  for (let i = 0; i < 3; i++) {
    const r = await send(contactForm({ email, mensaje: `${PREFIX}sonda ${i + 1} de prueba` }), { headers: { "x-real-ip": ip() } });
    if (r.value?.ok === true) accepted++;
  }
  return 3 - accepted;
}
const ip = randomIp; // IPv6 de documentación (RFC 3849): nunca es una IP real y casi nunca se repite

describe("E19. inyección SQL y caracteres especiales en parámetros públicos", opts, () => {
  const PAYLOADS = [
    `' OR '1'='1`, `'; DROP TABLE products;--`, `" OR ""="`, `%`, `_`, `\\`, `x%,id.not.is.null`, `x%) or (activo.eq.false`,
    `nombre.ilike.%`, `)),(`, `1;select pg_sleep(5)`, `<script>alert(1)</script>`, `${"${7*7}"}`, `{{7*7}}`, `%00`, `%0d%0aSet-Cookie:x=1`,
    `😀`, `a`.repeat(500), `..%2f..%2f`, `*`, `&q=otra`, `[]`,
  ];
  let baseline = 0;
  const products = (html) => new Set([...html.matchAll(/href="\/producto\/([^"?#]+)"/g)].map((m) => m[1])).size;

  test("línea base: el catálogo normal lista productos", async () => {
    const r = await getPage("/catalogo");
    baseline = products(r.text);
    assert.ok(baseline > 0, "el catálogo de desarrollo no tiene productos");
  });
  for (const p of PAYLOADS) {
    test(`q=${JSON.stringify(p).slice(0, 40)}`, async () => {
      const t0 = Date.now();
      const r = await getPage(`/catalogo?q=${encodeURIComponent(p)}`);
      const ms = Date.now() - t0;
      const noLeak = !LEAK_SQL.test(r.text.replace(/<script[\s\S]*?<\/script>/g, ""));
      // Una inyección no puede AMPLIAR el resultado: ninguna de estas cadenas coincide con un producto real.
      const n = products(r.text);
      check(assert, "E19", `q=${JSON.stringify(p).slice(0, 30)}`, "sin error SQL, sin más productos que el catálogo completo, rápido", `${r.status}, ${n} productos, ${ms} ms${noLeak ? "" : " (filtra SQL)"}`, r.status < 500 && noLeak && n <= baseline && ms < 4500);
    });
  }
  test("parámetros de orden, precio y página con valores hostiles", async () => {
    const cases = [
      "orden=precio-asc;drop", "orden=%27", "orden[]=x", "min=-1", "min=1e999", "max=NaN", "min=abc&max=%27", "pagina=0", "pagina=-5", "pagina=99999999999999999999",
      "pagina=1.5", "pagina=%00", "pagina=1&pagina=2", "min=" + "9".repeat(400), "q=a&q=b&orden=x&orden=y",
    ];
    for (const qs of cases) {
      const r = await getPage(`/catalogo?${qs}`);
      check(assert, "E19", `/catalogo?${qs.slice(0, 40)}`, "sin 5xx ni error SQL", `${r.status}`, r.status < 500 && !LEAK_SQL.test(r.text.replace(/<script[\s\S]*?<\/script>/g, "")));
    }
  });
  test("slugs hostiles en categoría, producto y pedido responden 404 (o 400) sin filtrar", async () => {
    const slugs = [`'`, `' OR 1=1--`, `..%2f..%2fetc%2fpasswd`, `%2e%2e%2f`, `a'b`, `%00`, `x`.repeat(400), `00000000-0000-0000-0000-000000000000`, `MC-AAAAAAAA`, `<script>`, `%3Cscript%3E`, `${"${1+1}"}`];
    const soft = new Set();
    const softLogin = new Set();
    for (const base of ["/categoria/", "/producto/", "/confirmacion/"]) {
      for (const s of slugs) {
        let status;
        let leak = false;
        let softNotFound = false;
        try {
          const r = await getPage(base + (s.includes("%") || s.startsWith("..") ? s : encodeURIComponent(s)));
          status = r.status;
          leak = LEAK_SQL.test(r.text.replace(/<script[\s\S]*?<\/script>/g, ""));
          // 200 con la pantalla "No encontrado" y noindex: la respuesta ya había empezado a enviarse (streaming).
          softNotFound = r.status === 200 && /<title>No encontrado/.test(r.text);
          // Páginas con sesión: sin sesión, el redirect a /login llega como <meta refresh> (200) y NUNCA con datos del pedido.
          if (r.status === 200 && /http-equiv="refresh"[^>]*url=\/login/.test(r.text) && !/Monto exacto|Cuentas para transferir/.test(r.text)) softLogin.add(base);
        } catch (e) {
          status = `rechazada (${e.cause?.code ?? e.name})`;
        }
        if (softNotFound) soft.add(base);
        const okStatus = typeof status === "string" || status === 404 || status === 400 || status === 307 || status === 308 || softNotFound || softLogin.has(base);
        check(assert, "E19", `${base}${s.slice(0, 25)}`, "no encontrado, sin filtrar (sin datos ni errores)", `${status}${softNotFound ? " (pantalla 'No encontrado')" : ""}${leak ? " (filtra)" : ""}`, okStatus && !leak);
      }
    }
    for (const base of softLogin) rec("E19", `${base}<referencia ajena>: redirect a /login`, "307 desde el servidor", "200 con meta refresh a /login, sin datos del pedido (streaming de Next)", "hallazgo");
    for (const base of soft) rec("E19", `${base}<inexistente>: código HTTP`, "404 (CLAUDE.md, sección 4)", "200 con la pantalla 'No encontrado' (soft-404)", "hallazgo");
  });
});

describe("E18. contenido hostil en el formulario de contacto (sin sesión)", { skip: (!up || !haveService) && "necesita servidor y service_role (solo para leer el resultado)" }, () => {
  test("HTML, comillas, CRLF y marcadores se rechazan o se guardan como texto; nunca como HTML", async () => {
    const payloads = [
      { campo: "nombre", valor: `<script>alert(1)</script>`, rechazo: true },
      { campo: "nombre", valor: `<img src=x onerror=alert(1)>`, rechazo: true },
      { campo: "asunto", valor: `<b>negrita</b>`, rechazo: true },
      { campo: "mensaje", valor: `${PREFIX}mensaje <script>alert(1)</script> largo`, rechazo: true },
      { campo: "mensaje", valor: `${PREFIX}mensaje con comillas " ' y \${process.env.X} {{7*7}} ok`, rechazo: false },
      { campo: "asunto", valor: `${PREFIX}asunto\r\nBcc: x@example.com`, rechazo: true },
      { campo: "nombre", valor: `${PREFIX}nombre\r\nSubject: hola`, rechazo: true },
      { campo: "mensaje", valor: `${PREFIX}línea 1\nlínea 2\r\nlínea 3 con salto`, rechazo: false },
    ];
    for (const [i, p] of payloads.entries()) {
      const email = `${PREFIX}inj${i}-${run}@example.com`;
      const fd = contactForm({ email });
      fd.set(p.campo, p.valor);
      const r = await send(fd, { headers: { "x-real-ip": ip() } });
      const rejected = r.value && r.value.ok !== true;
      if (p.rechazo) {
        const before = rejected ? await storedBefore(email) : -1;
        check(assert, "E18", `${p.campo}: ${JSON.stringify(p.valor).slice(0, 38)}`, "rechazado, no se guarda", `${rejected ? "rechazado" : "ACEPTADO"}${before > 0 ? " pero guardado" : ""}`, rejected && before === 0);
      } else {
        // Se acepta como texto plano. El panel lo escapa (React, sin dangerouslySetInnerHTML) y el correo lo escapa
        // (injection.test.ts). El contenido guardado no se puede leer con service_role (sin SELECT, a propósito).
        check(assert, "E18", `${p.campo}: ${JSON.stringify(p.valor).slice(0, 38)}`, "aceptado como texto", rejected ? `rechazado (${JSON.stringify(r.value).slice(0, 60)})` : "aceptado", !rejected);
      }
    }
  });
  test("el campo trampa (sitio_web) descarta el mensaje sin guardarlo", async () => {
    const email = `${PREFIX}trampa-${run}@example.com`;
    const r = await send(contactForm({ email, extra: { sitio_web: "http://spam.example" } }), { headers: { "x-real-ip": ip() } });
    const before = await storedBefore(email);
    check(assert, "E18", "campo trampa lleno", "responde ok pero no guarda", `${JSON.stringify(r.value)} / guardados=${before}`, r.value?.ok === true && before === 0);
  });
});

describe("E20. enumeración de cuentas: misma respuesta exista o no el correo", { skip: (!up || !haveService) && "necesita servidor y service_role (para elegir un correo existente)" }, () => {
  test("login: correo existente con contraseña errónea vs correo inexistente", async () => {
    const users = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }).then((r) => r.json());
    const existing = users.users?.[0]?.email;
    assert.ok(existing, "no hay usuarios");
    const attempt = async (email) => {
      const t0 = Date.now();
      const r = await callAction("iniciarSesion", [{}, form({ email, password: "Incorrecta-zz-sec-1", "cf-turnstile-response": TURN })]);
      return { value: r.value, ms: Date.now() - t0, status: r.status };
    };
    const a = await attempt(existing);
    const b = await attempt(`${PREFIX}noexiste-${run}@example.com`);
    check(assert, "E20", "login: mensaje con correo existente vs inexistente", "idéntico", `${a.value?.error} | ${b.value?.error}`, Boolean(a.value?.error) && a.value.error === b.value?.error && a.status === b.status);
    rec("E20", "login: diferencia de tiempo (informativa)", "sin diferencia grande", `${a.ms} ms vs ${b.ms} ms`, Math.abs(a.ms - b.ms) < 1500 ? "ok" : "bloqueado");
  });
  test("recuperación de contraseña: la respuesta es la misma para un correo inexistente que para uno mal escrito", async () => {
    const r1 = await callAction("solicitarRecuperacion", [{}, form({ email: `${PREFIX}noexiste1-${run}@example.com`, "cf-turnstile-response": TURN })]);
    const r2 = await callAction("solicitarRecuperacion", [{}, form({ email: `${PREFIX}noexiste2-${run}@example.com`, "cf-turnstile-response": TURN })]);
    check(assert, "E20", "recuperar: dos correos inexistentes", "mismo mensaje genérico", `${JSON.stringify(r1.value).slice(0, 70)}`, JSON.stringify(r1.value) === JSON.stringify(r2.value) && Boolean(r1.value?.ok));
    rec("E20", "recuperar y registrar con un correo EXISTENTE", "misma respuesta", "no probado: enviaría correos a una cuenta real o crearía una cuenta (se prueba con la cuenta de prueba cuando exista)", "bloqueado");
  });
});

describe("F21. redirecciones abiertas (next, redirect, return_to)", opts, () => {
  const EVIL = ["https://otro.com", "//otro.com", "///otro.com", "/\\otro.com", "\\\\otro.com", "javascript:alert(1)", "/cuenta/../../otro.com", "/cuenta//otro.com", "http://localhost:3101@otro.com", "/cuenta\n//otro.com", "/cuenta%0d%0aLocation:%20https://otro.com", "data:text/html,x", "/admin", "/cuenta/%2e%2e/admin"];
  test("la ruta de confirmación de correo nunca redirige fuera del sitio", async () => {
    for (const next of EVIL) {
      for (const qs of [`code=zz-sec&next=${encodeURIComponent(next)}`, `token_hash=zz&type=signup&next=${encodeURIComponent(next)}`, `next=${encodeURIComponent(next)}`, `redirect=${encodeURIComponent(next)}&return_to=${encodeURIComponent(next)}`]) {
        const r = await getPage(`/cuenta/confirmar?${qs}`);
        const loc = r.location ?? "";
        const same = !loc || loc.startsWith("/") || new URL(loc, APP_URL).origin === APP_URL;
        check(assert, "F21", `/cuenta/confirmar ?${qs.slice(0, 40)}`, "redirige solo dentro del sitio", `${r.status} → ${loc.slice(0, 50)}`, same && !/otro\.com/.test(loc));
      }
    }
  });
  test("/login, /registro y /recuperar con next/redirect/return_to hostiles no los reflejan activos", async () => {
    for (const path of ["/login", "/registro", "/recuperar"]) {
      for (const next of EVIL) {
        const r = await getPage(`${path}?next=${encodeURIComponent(next)}&redirect=${encodeURIComponent(next)}&return_to=${encodeURIComponent(next)}`);
        // Si el valor se refleja en un campo oculto, la acción lo vuelve a filtrar con safeNext (probado en unit).
        // Aquí se exige que NUNCA aparezca como href, action, src o formaction de la página (el JSON interno de Next no cuenta).
        const live = /(?:href|action|src|formaction)=["'](?:(?:https?:)?\/\/otro\.com|javascript:)/i.test(r.text);
        check(assert, "F21", `${path}?next=${next.slice(0, 25)}`, "sin enlace activo al destino", `${r.status}${live ? " (enlace activo)" : ""}`, r.status < 500 && !live);
      }
    }
  });
  test("las redirecciones permanentes de /admin/login y /cuenta/login conservan solo rutas del sitio", async () => {
    for (const p of ["/admin/login?next=https://otro.com", "/cuenta/login?next=//otro.com", "/cuenta/registro?next=/\\otro.com"]) {
      const r = await getPage(p);
      check(assert, "F21", p, "Location relativo a /login|/registro", `${r.status} → ${(r.location ?? "").slice(0, 60)}`, /^\/(login|registro)/.test(r.location ?? "") || !/^https?:\/\/(?!localhost)/.test(r.location ?? ""));
    }
  });
  test("cabecera Host falsa: informar a dónde apuntan las redirecciones (en Vercel el Host lo fija la plataforma)", async () => {
    const res = await fetch(`${APP_URL}/cuenta/confirmar?code=zz`, { redirect: "manual", headers: { "X-Forwarded-Host": "evil.example" } });
    const loc = res.headers.get("location") ?? "";
    rec("F21", "X-Forwarded-Host falso en /cuenta/confirmar", "sin redirección a otro host (en local depende del proxy)", `${res.status} → ${loc.slice(0, 60)}`, /evil\.example/.test(loc) ? "bloqueado" : "ok");
  });
});

describe("F25. acciones del servidor desde otro origen (CSRF)", opts, () => {
  test("Origin ajeno: la acción no se ejecuta", async () => {
    const email = `${PREFIX}csrf-${run}@example.com`;
    const r = await send(contactForm({ email }), { origin: "https://evil.example", headers: { "x-real-ip": ip() } });
    const before = await storedBefore(email);
    check(assert, "F25", "POST con Origin https://evil.example", "rechazado y sin efecto", `${r.status}, guardados=${before}`, before === 0 && r.status >= 400);
  });
  test("Origin con otro puerto o null; mismo host con otro esquema (informativo)", async () => {
    const asHost = new URL(APP_URL).host;
    const e2 = `${PREFIX}csrf2s-${run}@example.com`;
    const rs = await send(contactForm({ email: e2 }), { origin: `https://${asHost}`, headers: { "x-real-ip": ip() } });
    // Next compara solo el host del Origin con el Host de la petición, no el esquema. No es explotable entre sitios:
    // un atacante no controla un origen con el mismo host. Se deja constancia.
    rec("F25", `Origin https://${asHost} (mismo host, otro esquema)`, "informativo: Next compara solo el host", `${rs.status}`, "ok");
    for (const origin of ["http://localhost:9999", "null"]) {
      const email = `${PREFIX}csrf2-${run}-${Math.random().toString(36).slice(2, 6)}@example.com`;
      const r = await send(contactForm({ email }), { origin, headers: { "x-real-ip": ip() } });
      const before = await storedBefore(email);
      check(assert, "F25", `Origin ${origin}`, "rechazado y sin efecto", `${r.status}, guardados=${before}`, before === 0);
    }
  });
  test("sin cabecera Origin (un navegador siempre la envía en un POST entre sitios): informar", async () => {
    const email = `${PREFIX}csrf3-${run}@example.com`;
    const r = await send(contactForm({ email }), { noOrigin: true, headers: { "x-real-ip": ip() } });
    rec("F25", "POST sin Origin (un navegador no puede omitirla entre sitios)", "informativo", `${r.status}, ${r.value?.ok ? "ejecutada" : "rechazada"}`, "ok");
  });
  test("GET con Next-Action no ejecuta nada", async () => {
    const res = await fetch(`${APP_URL}/contacto`, { headers: { "Next-Action": "0".repeat(42) } });
    check(assert, "F25", "GET con Next-Action", "sin ejecutar acciones", res.status, res.status < 500);
  });
  test("sin Turnstile válido (servidor estricto, como producción sin clave): contacto y login se rechazan", { skip: !upStrict && `no hay servidor en ${APP_STRICT_URL}` }, async () => {
    const email = `${PREFIX}estricto-${run}@example.com`;
    const r = await send(contactForm({ email }), { base: APP_STRICT_URL, headers: { "x-real-ip": ip() } });
    const before = await storedBefore(email);
    check(assert, "F25", "contacto sin clave de Turnstile en producción", "rechazado (falla cerrado)", `${JSON.stringify(r.value).slice(0, 80)} guardados=${before}`, before === 0 && r.value?.ok !== true);
    const l = await callAction("iniciarSesion", [{}, form({ email, password: "x-zz-sec-1", "cf-turnstile-response": "" })], { base: APP_STRICT_URL });
    check(assert, "F25", "login sin clave de Turnstile en producción", "rechazado", JSON.stringify(l.value).slice(0, 80), Boolean(l.value?.error));
  });
});

describe("G26-G28. límites de uso, cabeceras de IP falsas y tamaños", { skip: (!up || !haveService) && "necesita servidor y service_role" }, () => {
  test("contacto: el 4.º mensaje con el mismo correo en una hora se rechaza", async () => {
    const email = `${PREFIX}lim3-${run}@example.com`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await send(contactForm({ email, mensaje: `${PREFIX}mensaje número ${i + 1} de prueba` }), { headers: { "x-real-ip": ip() } })).value);
    const okCount = results.filter((v) => v?.ok === true).length;
    check(assert, "G26", "4 mensajes, mismo correo, IP distinta cada vez", "3 aceptados, 4.º rechazado", `${results.map((v) => (v?.ok ? "ok" : "rechazado")).join(", ")}`, okCount === 3 && results[3]?.ok !== true && /varios mensajes/.test(results[3]?.error ?? ""));
  });
  test("contacto: el mensaje 11 desde la misma IP se rechaza (correos distintos)", async () => {
    const sameIp = ip();
    const results = [];
    for (let i = 0; i < 11; i++) results.push((await send(contactForm({ email: `${PREFIX}lim10-${run}-${i}@example.com`, mensaje: `${PREFIX}mensaje de la ip ${i + 1}` }), { headers: { "x-real-ip": sameIp } })).value);
    const okCount = results.filter((v) => v?.ok === true).length;
    check(assert, "G26", "11 mensajes desde una IP, correos distintos", "10 aceptados, el 11.º rechazado", `${okCount} aceptados; 11.º: ${results[10]?.ok ? "ACEPTADO" : "rechazado"}`, okCount === 10 && results[10]?.ok !== true);
  });
  test("G27. cambiar x-real-ip / x-forwarded-for en cada petición esquiva el límite POR IP en local (el de por correo no)", async () => {
    const results = [];
    for (let i = 0; i < 12; i++) {
      const h = i % 2 === 0 ? { "x-real-ip": ip() } : { "x-forwarded-for": `${ip()}, 10.0.0.1` };
      results.push((await send(contactForm({ email: `${PREFIX}spoof-${run}-${i}@example.com`, mensaje: `${PREFIX}mensaje con ip falsa ${i}` }), { headers: h })).value);
    }
    const okCount = results.filter((v) => v?.ok === true).length;
    // En local no hay proxy: el servidor confía en lo que llegue. Se informa; el correo sigue limitado (prueba anterior).
    rec("G27", "rotar x-real-ip/x-forwarded-for con correos distintos", "en local: se esquiva; en Vercel la plataforma fija la IP", `${okCount}/12 aceptados`, okCount >= 11 ? "bloqueado" : "ok");
    const same = `${PREFIX}spoof-mismo-${run}@example.com`;
    const again = [];
    for (let i = 0; i < 4; i++) again.push((await send(contactForm({ email: same, mensaje: `${PREFIX}mismo correo ${i}` }), { headers: { "x-real-ip": ip() } })).value);
    check(assert, "G27", "mismo correo con IP falsa distinta cada vez", "el límite por correo se mantiene", again.map((v) => (v?.ok ? "ok" : "no")).join(","), again.filter((v) => v?.ok).length === 3);
  });
  test("login: ráfaga de intentos fallidos con el mismo correo (inexistente) termina en límite", async () => {
    const email = `${PREFIX}rafaga-${run}@example.com`;
    const msgs = [];
    for (let i = 0; i < 10; i++) msgs.push((await callAction("iniciarSesion", [{}, form({ email, password: `Mala-zz-sec-${i}`, "cf-turnstile-response": TURN })])).value?.error ?? "?");
    const limited = msgs.findIndex((m) => /Demasiados intentos/.test(m));
    check(assert, "G26", "10 intentos de login con el mismo correo", "bloqueo antes del 10.º", limited >= 0 ? `bloqueado en el intento ${limited + 1}` : "nunca se bloqueó", limited >= 0 && limited <= 8);
    check(assert, "G26", "el mensaje de límite no revela si la cuenta existe", "mismo texto para cualquier correo", msgs[limited] ?? "", /^Demasiados intentos\. Espera unos minutos/.test(msgs[limited] ?? ""));
  });
  test("G28. cuerpos gigantes y campos larguísimos", async () => {
    const big = "A".repeat(6 * 1024 * 1024);
    const res1 = await fetch(`${APP_URL}/contacto`, { method: "POST", headers: { "Next-Action": "x", "Content-Type": "text/plain;charset=UTF-8", Origin: APP_URL }, body: big });
    check(assert, "G28", "cuerpo de 6 MB a una acción", "rechazado (4xx/5xx), servidor vivo", res1.status, res1.status >= 400 && (await appUp()));
    const long = contactForm({ email: `${PREFIX}largo-${run}@example.com`, mensaje: "x".repeat(900000) });
    const r2 = await send(long, { headers: { "x-real-ip": ip() } });
    check(assert, "G28", "mensaje de 900 000 caracteres", "rechazado, no guardado", JSON.stringify(r2.value).slice(0, 70), r2.value?.ok !== true);
    const r3 = await send(contactForm({ email: `${PREFIX}largo2-${run}@example.com`, nombre: "n".repeat(100000) }), { headers: { "x-real-ip": ip() } });
    check(assert, "G28", "nombre de 100 000 caracteres", "rechazado", JSON.stringify(r3.value).slice(0, 70), r3.value?.ok !== true);
    const res4 = await fetch(`${APP_URL}/catalogo?q=${"a".repeat(60000)}`);
    check(assert, "G28", "URL de 60 KB", "rechazada o ignorada, sin 5xx", res4.status, res4.status < 500);
    const res5 = await fetch(`${APP_URL}/contacto`, { method: "POST", headers: { "Next-Action": actionOf("enviarMensaje"), "Content-Type": "application/json", Origin: APP_URL }, body: "{no-es-json" });
    check(assert, "G28", "JSON mal formado a una acción", "rechazado sin trazas", res5.status, res5.status >= 400 && !LEAK_SQL.test(await res5.text()));
  });
  test("G28. ráfaga de peticiones por segundo a rutas públicas: el servidor responde y no devuelve 5xx", async () => {
    const paths = ["/", "/catalogo", "/contacto", "/privacidad", "/carrito", "/login"];
    const t0 = Date.now();
    const all = await Promise.all(Array.from({ length: 240 }, (_, i) => fetch(APP_URL + paths[i % paths.length]).then((r) => r.status).catch(() => 0)));
    const ms = Date.now() - t0;
    const bad = all.filter((s) => s === 0 || s >= 500).length;
    check(assert, "G28", "240 peticiones concurrentes a 6 rutas públicas", "sin 5xx ni caídas", `${bad} fallidas de 240 en ${ms} ms`, bad === 0 && (await appUp()));
  });
});

import { actionId } from "./lib.mjs";
const actionOf = (n) => actionId(n);
