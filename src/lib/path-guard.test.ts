import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { hasMalformedEncoding } from "./path-guard.ts";

test("detecta un % mal formado y deja pasar las rutas normales", () => {
  for (const bad of ["/producto/%E0%A4%A", "/producto/%FF", "/categoria/%", "/x/%zz", "/a%2"]) {
    assert.equal(hasMalformedEncoding(bad), true, bad);
  }
  for (const good of ["/", "/catalogo", "/producto/silla-roja", "/producto/%C3%B1", "/categoria/a%20b", "/producto/100%25"]) {
    assert.equal(hasMalformedEncoding(good), false, good);
  }
});

test("el proxy responde 400 a una ruta mal codificada antes de consultar Supabase", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /hasMalformedEncoding\(pathname\)/);
  assert.match(proxy, /status:\s*400/);
  assert.ok(proxy.indexOf("hasMalformedEncoding") < proxy.indexOf("getSupabaseEnv()"), "se comprueba antes de leer el entorno de Supabase");
});
