import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAvailableSlug, slugify } from "./slug.ts";

const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test("slugify quita tildes, eñes y símbolos", () => {
  assert.equal(slugify("Decoración y muebles"), "decoracion-y-muebles");
  assert.equal(slugify("Baño"), "bano");
  assert.equal(slugify("Ollas & sartenes"), "ollas-y-sartenes");
  assert.equal(slugify("  --Cocina  (nueva)!  "), "cocina-nueva");
});

test("slugify siempre devuelve un slug válido", () => {
  for (const input of ["", "!!!", "   ", "🏠", "A".repeat(300), "a-b--c", "---"]) {
    const s = slugify(input, "categoria");
    assert.match(s, VALID, JSON.stringify(input));
    assert.ok(s.length <= 80);
  }
  assert.equal(slugify("🏠", "categoria"), "categoria");
});

test("nextAvailableSlug agrega un número si ya existe", () => {
  assert.equal(nextAvailableSlug("cocina", new Set()), "cocina");
  assert.equal(nextAvailableSlug("cocina", new Set(["cocina"])), "cocina-2");
  assert.equal(nextAvailableSlug("cocina", new Set(["cocina", "cocina-2", "cocina-3"])), "cocina-4");
});

test("nextAvailableSlug respeta el largo máximo y sigue siendo válido", () => {
  const base = "a".repeat(80);
  const s = nextAvailableSlug(base, new Set([base]));
  assert.match(s, VALID);
  assert.ok(s.length <= 80);
  assert.notEqual(s, base);
});
