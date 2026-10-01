import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RATE_LIMITED_MESSAGE,
  RATE_RULES,
  RATE_UNAVAILABLE_MESSAGE,
  emailIdentity,
  firstBlocking,
  interpretRateLimit,
  rateLimitMessage,
} from "./rate-limit-core.ts";

test("respuesta de la base: true permite, false limita", () => {
  assert.equal(interpretRateLimit({ data: true, error: null }, "closed"), "allow");
  assert.equal(interpretRateLimit({ data: false, error: null }, "closed"), "limited");
  assert.equal(interpretRateLimit({ data: false, error: null }, "open"), "limited", "un límite alcanzado limita también en modo abierto");
});

test("si la función de límite falla: cerrado rechaza, abierto deja pasar", () => {
  const failures = [
    { data: null, error: { message: "function rate_limit_hit does not exist" } },
    { data: null, error: null },
    { data: "true", error: null },
    { thrown: new Error("fetch failed") },
  ];
  for (const f of failures) {
    assert.equal(interpretRateLimit(f, "closed"), "unavailable", JSON.stringify(f));
    assert.equal(interpretRateLimit(f, "open"), "allow", JSON.stringify(f));
  }
});

test("varios controles: decide el primero que bloquea", () => {
  assert.equal(firstBlocking([]), "allow");
  assert.equal(firstBlocking(["allow", "allow"]), "allow");
  assert.equal(firstBlocking(["allow", "limited"]), "limited");
  assert.equal(firstBlocking(["unavailable", "limited"]), "unavailable");
});

test("mensajes claros y que no revelan si el correo tiene cuenta", () => {
  assert.equal(rateLimitMessage("allow"), null);
  assert.equal(rateLimitMessage("limited"), RATE_LIMITED_MESSAGE);
  assert.equal(rateLimitMessage("unavailable"), RATE_UNAVAILABLE_MESSAGE);
  for (const m of [RATE_LIMITED_MESSAGE, RATE_UNAVAILABLE_MESSAGE]) {
    assert.doesNotMatch(m, /cuenta|correo|existe|registrad/i);
  }
});

test("el correo se normaliza: mismas mayúsculas y espacios, mismo contador", () => {
  assert.equal(emailIdentity("  Ana@Correo.COM "), "ana@correo.com");
});

test("reglas: buckets válidos para la base y únicos, límites positivos", () => {
  const buckets = Object.values(RATE_RULES).map((r) => r.bucket);
  assert.equal(new Set(buckets).size, buckets.length, "cada regla tiene su propio contador");
  for (const r of Object.values(RATE_RULES)) {
    assert.match(r.bucket, /^[a-z0-9_]{1,40}$/, r.bucket);
    assert.ok(r.max >= 1 && r.max <= 10000, r.bucket);
    assert.ok(r.windowSeconds >= 1 && r.windowSeconds <= 7 * 24 * 3600, r.bucket);
  }
  assert.ok(RATE_RULES.loginIp.max > RATE_RULES.loginEmail.max, "por IP es más holgado (IP compartidos)");
});
