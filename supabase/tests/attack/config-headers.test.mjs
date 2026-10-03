// H. Cabeceras y configuración, contra `next start` (build de producción). Todo debe cumplirse.
//   npm run build && npm run start   (puerto 3100)   y   node supabase/tests/attack/serve-test-turnstile.mjs  (3101)
// Variables: ATTACK_APP_URL (por defecto http://localhost:3101). Sin llaves.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { APP_URL, appUp, assertDevOnly, check, getPage, installSummary, rec } from "./lib.mjs";

installSummary("H. Cabeceras y configuración");
const up = await appUp();
const opts = { skip: !up && `no hay servidor en ${APP_URL}` };
if (up) assertDevOnly();

const PAGES = ["/", "/catalogo", "/login", "/contacto", "/privacidad", "/terminos", "/cookies", "/carrito", "/zz-sec-no-existe", "/admin", "/cuenta", "/robots.txt", "/sitemap.xml"];
const REQUIRED = {
  "x-content-type-options": /^nosniff$/i,
  "x-frame-options": /^DENY$/i,
  "referrer-policy": /strict-origin-when-cross-origin/,
  "permissions-policy": /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
  "strict-transport-security": /max-age=\d{8,}.*includeSubDomains/,
  "cross-origin-opener-policy": /same-origin/,
};

describe("H1. cabeceras de seguridad en todas las rutas", opts, () => {
  for (const path of PAGES) {
    test(`cabeceras en ${path}`, async () => {
      const r = await getPage(path);
      for (const [name, re] of Object.entries(REQUIRED)) {
        const v = r.headers.get(name);
        check(assert, "H1", `${name} en ${path}`, String(re), v ?? "(ausente)", Boolean(v && re.test(v)));
      }
      const csp = r.headers.get("content-security-policy") ?? r.headers.get("content-security-policy-report-only");
      check(assert, "H1", `CSP (o Report-Only) en ${path}`, "presente", csp ? "presente" : "(ausente)", Boolean(csp));
      check(assert, "H1", `sin X-Powered-By en ${path}`, "ausente", r.headers.get("x-powered-by") ?? "ausente", !r.headers.get("x-powered-by"));
    });
  }
  test("la CSP prohíbe frames, objetos y base; permite solo lo necesario", async () => {
    const r = await getPage("/");
    const csp = r.headers.get("content-security-policy") ?? r.headers.get("content-security-policy-report-only") ?? "";
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"]) {
      check(assert, "H1", `CSP incluye ${d}`, d, csp.includes(d) ? "sí" : "no", csp.includes(d));
    }
    check(assert, "H1", "la CSP no permite 'unsafe-eval' en producción", "sin unsafe-eval", csp.includes("unsafe-eval") ? "lo permite" : "no", !csp.includes("unsafe-eval"));
    check(assert, "H1", "la CSP no permite scripts de comodín (*)", "sin script-src *", /script-src[^;]*\s\*(\s|;|$)/.test(csp) ? "comodín" : "ok", !/script-src[^;]*\s\*(\s|;|$)/.test(csp));
  });
  test("estado de la CSP: informar si sigue en Report-Only (no bloquea)", async () => {
    const r = await getPage("/");
    const enforcing = Boolean(r.headers.get("content-security-policy"));
    // No es un fallo de la aplicación: es una decisión pendiente (CLAUDE.md, sección 10). Se deja constancia.
    rec("H1", "la CSP bloquea (no solo informa)", "bloqueo (decisión pendiente del dueño)", enforcing ? "bloquea" : "solo Report-Only", enforcing ? "ok" : "bloqueado");
  });
});


describe("H2. métodos HTTP no permitidos y CORS", opts, () => {
  for (const method of ["PUT", "DELETE", "PATCH"]) {
    test(`${method} a páginas públicas no tiene efecto`, async () => {
      for (const path of ["/", "/catalogo", "/cuenta/confirmar", "/checkout"]) {
        const res = await fetch(APP_URL + path, { method, redirect: "manual", body: method === "DELETE" ? undefined : "x" });
        const ok = res.status >= 300; // 3xx/4xx/5xx: nunca un 200 con contenido
        check(assert, "H2", `${method} ${path}`, "no 2xx", res.status, ok);
      }
    });
  }
  test("OPTIONS con Origin ajeno: sin CORS abierto", async () => {
    const res = await fetch(APP_URL + "/catalogo", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    const acao = res.headers.get("access-control-allow-origin");
    check(assert, "H2", "OPTIONS con Origin ajeno", "sin Access-Control-Allow-Origin", acao ?? "(ausente)", !acao || (acao !== "*" && !acao.includes("evil")));
  });
  test("GET con Origin ajeno: sin Access-Control-Allow-Origin", async () => {
    const res = await fetch(APP_URL + "/catalogo", { headers: { Origin: "https://evil.example" } });
    const acao = res.headers.get("access-control-allow-origin");
    check(assert, "H2", "GET con Origin ajeno", "sin CORS", acao ?? "(ausente)", !acao);
  });
  test("las cookies de la tienda anónima: ninguna se fija sin sesión", async () => {
    const res = await fetch(APP_URL + "/catalogo", { redirect: "manual" });
    const sc = res.headers.getSetCookie?.() ?? [];
    check(assert, "H2", "Set-Cookie en una visita anónima", "ninguna", sc.length, sc.length === 0);
  });
});

describe("H3. errores que no filtran rutas ni trazas", opts, () => {
  const LEAK = /(?:[A-Z]:\\|\/Users\/|node_modules|\.next[\\/]|webpack|at \S+ \(|Error:|stack|Escritorio|\.tsx?:\d+|SUPABASE_[A-Z_]+|service_role)/;
  const PATHS = [
    "/zz-sec-no-existe",
    "/producto/%E0%A4%A",
    "/producto/%00",
    "/categoria/%00",
    "/categoria/" + "a".repeat(5000),
    "/producto/" + "x".repeat(300),
    "/confirmacion/%27%20OR%201%3D1--",
    "/catalogo?pagina=%00&orden=%27",
    "/catalogo?q=" + "a".repeat(5000),
    "/_next/zz-sec",
    "/admin/zz-sec-no-existe",
  ];
  for (const path of PATHS) {
    test(`error en ${path.slice(0, 60)}`, async () => {
      let res;
      try {
        res = await getPage(path);
      } catch (e) {
        // La petición fue rechazada por el cliente HTTP o el servidor cerró: no hay filtración posible.
        check(assert, "H3", `${path.slice(0, 40)}`, "sin filtración", `conexión rechazada (${e.cause?.code ?? e.name})`, true);
        return;
      }
      const leaks = LEAK.test(res.text.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, ""));
      check(assert, "H3", `${path.slice(0, 40)}`, "4xx/3xx/200 sin trazas", `${res.status}${leaks ? " (filtra)" : ""}`, res.status < 500 && !leaks);
    });
  }
  test("una acción con ID inválido responde sin trazas", async () => {
    const res = await fetch(APP_URL + "/", { method: "POST", headers: { "Next-Action": "0".repeat(42), "Content-Type": "text/plain;charset=UTF-8" }, body: "[]" });
    const text = await res.text();
    check(assert, "H3", "Next-Action inexistente", "sin trazas", `${res.status}${LEAK.test(text) ? " (filtra)" : ""}`, !LEAK.test(text) && res.status < 500);
  });
  test("cuerpo no válido en una acción", async () => {
    const res = await fetch(APP_URL + "/contacto", { method: "POST", headers: { "Next-Action": "x", "Content-Type": "application/json" }, body: "{no-json" });
    const text = await res.text();
    check(assert, "H3", "JSON mal formado a una acción", "sin trazas", `${res.status}${LEAK.test(text) ? " (filtra)" : ""}`, !LEAK.test(text));
  });
});

describe("H4. rutas de desarrollo, archivos sensibles y mapas de código", opts, () => {
  const SENSITIVE = ["/.env", "/.env.local", "/.git/config", "/.git/HEAD", "/package.json", "/package-lock.json", "/next.config.ts", "/src/app/page.tsx", "/src/proxy.ts", "/supabase/migrations/20260929000001_schema.sql", "/.next/BUILD_ID", "/.claude/settings.json", "/CLAUDE.md", "/README.md", "/_next/webpack-hmr", "/__nextjs_original-stack-frames", "/_next/static/development/_buildManifest.js", "/api", "/api/health", "/server-status", "/.well-known/security.txt"];
  for (const path of SENSITIVE) {
    test(`${path} no se sirve`, async () => {
      const res = await getPage(path);
      const body = res.text.slice(0, 2000);
      const leaked = /SUPABASE|service_role|create table|"scripts"|"dependencies"|\[core\]|# Tienda online/i.test(body) && res.status === 200;
      check(assert, "H4", `GET ${path}`, "404/redirección sin contenido", `${res.status}${leaked ? " (contenido)" : ""}`, !leaked && res.status !== 200);
    });
  }
  test("los mapas de código (.map) de los scripts no se publican", async () => {
    const html = (await getPage("/")).text;
    const scripts = [...html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)].map((m) => m[0]).slice(0, 6);
    assert.ok(scripts.length > 0, "no se encontraron scripts");
    for (const s of scripts) {
      const res = await fetch(`${APP_URL}${s}.map`);
      check(assert, "H4", `${s.slice(-30)}.map`, "no existe", res.status, res.status === 404);
    }
  });
  test("el HTML y los scripts no incluyen la llave service_role ni secretos", async () => {
    const html = (await getPage("/")).text;
    const scripts = [...html.matchAll(/\/_next\/static\/[^"'\s]+\.js/g)].map((m) => m[0]).slice(0, 12);
    const bodies = [html];
    for (const s of scripts) bodies.push(await (await fetch(APP_URL + s)).text());
    const joined = bodies.join("\n");
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    check(assert, "H4", "la service_role no está en el JavaScript del navegador", "ausente", svc && joined.includes(svc) ? "PRESENTE" : "ausente", !(svc && joined.includes(svc)));
    check(assert, "H4", "ninguna clave 'service_role' ni 'SUPABASE_SERVICE' en el cliente", "ausente", /SUPABASE_SERVICE|RATE_LIMIT_SECRET|TURNSTILE_SECRET/.test(joined) ? "PRESENTE" : "ausente", !/SUPABASE_SERVICE|RATE_LIMIT_SECRET|TURNSTILE_SECRET/.test(joined));
  });
});

describe("H5. robots.txt y sitemap", opts, () => {
  const PRIVATE = ["/admin", "/cuenta", "/login", "/registro", "/recuperar", "/nueva-clave", "/carrito", "/checkout", "/confirmacion"];
  test("robots.txt bloquea las zonas privadas", async () => {
    const t = (await getPage("/robots.txt")).text;
    for (const p of PRIVATE) check(assert, "H5", `robots.txt: Disallow ${p}`, "presente", t.includes(`Disallow: ${p}`) ? "sí" : "no", t.includes(`Disallow: ${p}`));
  });
  test("el sitemap no lista rutas privadas ni de prueba ajenas", async () => {
    const t = (await getPage("/sitemap.xml")).text;
    const urls = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    assert.ok(urls.length > 3);
    for (const u of urls) {
      const bad = PRIVATE.some((p) => u === p || u.startsWith(p + "/"));
      check(assert, "H5", `sitemap ${u}`, "ruta pública", bad ? "PRIVADA" : "pública", !bad);
    }
  });
});

describe("H6. cookies de sesión (configuración)", () => {
  test("las cookies de sesión de Supabase se marcan Secure en producción y SameSite=Lax", () => {
    for (const f of ["src/lib/supabase/server.ts", "src/proxy.ts"]) {
      const src = readFileSync(f, "utf8");
      check(assert, "H6", `${f}: cookieOptions con secure`, "secure en producción", /cookieOptions:[^}]*secure:\s*process\.env\.NODE_ENV === "production"/s.test(src) ? "sí" : "no", /cookieOptions:[^}]*secure:\s*process\.env\.NODE_ENV === "production"/s.test(src));
    }
  });
  test("la cookie de recuperación es httpOnly, Lax y Secure en producción", () => {
    const src = readFileSync("src/lib/recovery-cookie.ts", "utf8");
    check(assert, "H6", "mc_recuperacion: httpOnly", "sí", /httpOnly:\s*true/.test(src) ? "sí" : "no", /httpOnly:\s*true/.test(src));
    check(assert, "H6", "mc_recuperacion: sameSite lax", "sí", /sameSite:\s*"lax"/.test(src) ? "sí" : "no", /sameSite:\s*"lax"/.test(src));
    check(assert, "H6", "mc_recuperacion: secure en producción", "sí", /secure:\s*process\.env\.NODE_ENV === "production"/.test(src) ? "sí" : "no", /secure:\s*process\.env\.NODE_ENV === "production"/.test(src));
  });
});
