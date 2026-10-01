import assert from "node:assert/strict";
import { test } from "node:test";
import { RECOVERY_TTL_SECONDS, signRecovery, verifyRecovery } from "./recovery-token.ts";

const SECRET = "secreto-de-prueba";
const USER = "00000000-0000-0000-0000-0000000000c1";
const NOW = 1_800_000_000_000;

test("el aviso de recuperación vale para su usuario mientras no venza", () => {
  const token = signRecovery(USER, SECRET, NOW);
  assert.equal(verifyRecovery(token, USER, SECRET, NOW), true);
  assert.equal(verifyRecovery(token, USER, SECRET, NOW + RECOVERY_TTL_SECONDS * 1000 - 1), true);
});

test("vencido, de otro usuario o con otra clave: no vale", () => {
  const token = signRecovery(USER, SECRET, NOW);
  assert.equal(verifyRecovery(token, USER, SECRET, NOW + RECOVERY_TTL_SECONDS * 1000), false, "vencido");
  assert.equal(verifyRecovery(token, "00000000-0000-0000-0000-0000000000a1", SECRET, NOW), false, "otro usuario");
  assert.equal(verifyRecovery(token, USER, "otra-clave", NOW), false, "otra clave");
});

test("alterado o mal formado: no vale", () => {
  const token = signRecovery(USER, SECRET, NOW);
  const [user, , sig] = token.split(".");
  assert.equal(verifyRecovery(`${user}.${NOW + 10 ** 9}.${sig}`, USER, SECRET, NOW), false, "vencimiento cambiado");
  assert.equal(verifyRecovery(`${token}x`, USER, SECRET, NOW), false, "firma cambiada");
  for (const bad of [undefined, "", "a.b", "a.b.c.d", `${user}.abc.${sig}`, "x".repeat(400)]) {
    assert.equal(verifyRecovery(bad, USER, SECRET, NOW), false, String(bad).slice(0, 20));
  }
});
