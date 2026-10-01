import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSiteUrl } from "./site-url.ts";

test("producción sin NEXT_PUBLIC_SITE_URL: error claro, nunca localhost", () => {
  for (const raw of [undefined, "", "   "]) {
    assert.throws(() => resolveSiteUrl(raw, "production"), /Falta NEXT_PUBLIC_SITE_URL/);
  }
});

test("desarrollo sin la variable: localhost", () => {
  assert.equal(resolveSiteUrl(undefined, "development"), "http://localhost:3000");
  assert.equal(resolveSiteUrl("", "test"), "http://localhost:3000");
});

test("se normaliza al origen, sin barra final", () => {
  assert.equal(resolveSiteUrl("https://micasastore.ec/", "production"), "https://micasastore.ec");
  assert.equal(resolveSiteUrl(" https://www.micasastore.ec ", "production"), "https://www.micasastore.ec");
});

test("http solo para localhost (para probar `next start` en local)", () => {
  assert.equal(resolveSiteUrl("http://localhost:3000", "production"), "http://localhost:3000");
  assert.throws(() => resolveSiteUrl("http://micasastore.ec", "production"), /https/);
});

test("valores inválidos: mensaje claro", () => {
  assert.throws(() => resolveSiteUrl("micasastore.ec", "production"), /no es una URL válida/);
  assert.throws(() => resolveSiteUrl("https://micasastore.ec/tienda", "production"), /solo el dominio/);
  assert.throws(() => resolveSiteUrl("https://micasastore.ec/?a=1", "production"), /solo el dominio/);
});
