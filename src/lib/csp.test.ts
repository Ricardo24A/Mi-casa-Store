import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsp, cspHeaderName } from "./csp.ts";

const directives = (csp: string) =>
  new Map(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)] as const));

test("el interruptor elige la cabecera: primero solo reporte", () => {
  assert.equal(cspHeaderName(false), "Content-Security-Policy-Report-Only");
  assert.equal(cspHeaderName(true), "Content-Security-Policy");
});

test("producción: Turnstile, imágenes de Supabase y QR permitidos; nada más de afuera", () => {
  const d = directives(buildCsp({ supabaseOrigin: "https://abc.supabase.co", dev: false, enforce: true }));
  assert.deepEqual(d.get("script-src"), ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"]);
  assert.deepEqual(d.get("frame-src"), ["https://challenges.cloudflare.com"]);
  assert.deepEqual(d.get("img-src"), ["'self'", "data:", "blob:", "https://abc.supabase.co"]);
  assert.deepEqual(d.get("connect-src"), ["'self'"]);
  assert.deepEqual(d.get("object-src"), ["'none'"]);
  assert.deepEqual(d.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(d.get("form-action"), ["'self'"]);
  assert.deepEqual(d.get("base-uri"), ["'self'"]);
  assert.ok(d.has("upgrade-insecure-requests"));
  assert.ok(!d.get("script-src")!.includes("'unsafe-eval'"), "sin eval en producción");
});

test("Report-Only no lleva upgrade-insecure-requests (el navegador lo ignora y avisa)", () => {
  assert.ok(!buildCsp({ dev: false, enforce: false }).includes("upgrade-insecure-requests"));
});

test("desarrollo: eval de React y websockets de la recarga, sin forzar https", () => {
  const d = directives(buildCsp({ dev: true, enforce: true }));
  assert.ok(d.get("script-src")!.includes("'unsafe-eval'"));
  assert.ok(d.get("connect-src")!.includes("ws:"));
  assert.ok(!d.has("upgrade-insecure-requests"));
  assert.deepEqual(d.get("img-src"), ["'self'", "data:", "blob:"], "sin URL de Supabase no se agrega nada");
});
