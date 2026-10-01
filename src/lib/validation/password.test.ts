import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordChangeSchema } from "./password.ts";

const base = { password: "nueva-clave-segura", confirm: "nueva-clave-segura", current: "", code: "" };
const fields = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => String(i.path[0]));

test("desde el enlace de recuperación: no pide la contraseña actual", () => {
  const r = passwordChangeSchema({ needsCurrent: false, needsCode: false }).safeParse(base);
  assert.equal(r.success, true);
});

test("desde una sesión normal: exige la contraseña actual (reautenticación)", () => {
  const rules = { needsCurrent: true, needsCode: false };
  assert.deepEqual(fields(passwordChangeSchema(rules).safeParse(base)), ["current"]);
  assert.equal(passwordChangeSchema(rules).safeParse({ ...base, current: "la-de-antes" }).success, true);
});

test("la nueva debe ser distinta de la actual", () => {
  const r = passwordChangeSchema({ needsCurrent: true, needsCode: false }).safeParse({ ...base, current: base.password });
  assert.deepEqual(fields(r), ["password"]);
});

test("administrador con 2FA sin validar: exige el código de 6 dígitos", () => {
  const rules = { needsCurrent: false, needsCode: true };
  assert.deepEqual(fields(passwordChangeSchema(rules).safeParse(base)), ["code"]);
  assert.deepEqual(fields(passwordChangeSchema(rules).safeParse({ ...base, code: "12345a" })), ["code"]);
  assert.equal(passwordChangeSchema(rules).safeParse({ ...base, code: " 123456 " }).success, true);
});

test("largo y confirmación", () => {
  const rules = { needsCurrent: false, needsCode: false };
  assert.deepEqual(fields(passwordChangeSchema(rules).safeParse({ ...base, password: "corta", confirm: "corta" })), ["password"]);
  assert.deepEqual(fields(passwordChangeSchema(rules).safeParse({ ...base, confirm: "otra-distinta-1" })), ["confirm"]);
});
