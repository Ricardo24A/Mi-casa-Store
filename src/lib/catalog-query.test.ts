import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Q_MAX_LENGTH,
  escapeLike,
  parseCatalogQuery,
  sanitizeSearch,
} from "./validation/catalog-query.ts";

test("escapeLike escapa % _ y la barra invertida", () => {
  assert.equal(escapeLike("50%_off"), "50\\%\\_off");
  assert.equal(escapeLike("a\\b"), "a\\\\b");
  assert.equal(escapeLike("silla"), "silla");
});

test("sanitizeSearch quita caracteres que rompen el filtro y acota el largo", () => {
  assert.equal(sanitizeSearch('silla,nombre.eq.x)("'), "silla nombre.eq.x");
  assert.equal(sanitizeSearch("  a   b  "), "a b");
  assert.equal(sanitizeSearch("x".repeat(500)).length, Q_MAX_LENGTH);
});

test("parseCatalogQuery devuelve valores por defecto con entrada vacía", () => {
  assert.deepEqual(parseCatalogQuery({}), {
    q: undefined,
    orden: "relevancia",
    min: undefined,
    max: undefined,
    pagina: 1,
  });
});

test("parseCatalogQuery interpreta parámetros válidos", () => {
  const r = parseCatalogQuery({ q: " taza ", orden: "precio-asc", min: "5", max: "20.5", pagina: "3" });
  assert.deepEqual(r, { q: "taza", orden: "precio-asc", min: 5, max: 20.5, pagina: 3 });
});

test("parseCatalogQuery ignora valores inválidos en vez de fallar", () => {
  const r = parseCatalogQuery({ orden: "hack", min: "-4", max: "abc", pagina: "0" });
  assert.deepEqual(r, { q: undefined, orden: "relevancia", min: undefined, max: undefined, pagina: 1 });
});

test("parseCatalogQuery toma el primer valor si el parámetro se repite", () => {
  assert.equal(parseCatalogQuery({ q: ["uno", "dos"] }).q, "uno");
});

test("parseCatalogQuery descarta un máximo menor que el mínimo", () => {
  const r = parseCatalogQuery({ min: "30", max: "10" });
  assert.equal(r.min, 30);
  assert.equal(r.max, undefined);
});

test("parseCatalogQuery: búsqueda que queda vacía tras sanear se ignora", () => {
  assert.equal(parseCatalogQuery({ q: ',,()"' }).q, undefined);
});
