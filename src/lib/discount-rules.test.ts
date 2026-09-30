import assert from "node:assert/strict";
import { test } from "node:test";
import { discountStatus, discountValueLabel, isoToLocal, localToIso } from "./discount-rules.ts";

const NOW = new Date("2026-10-01T12:00:00Z");

test("estado: inactivo, programado, vigente y vencido", () => {
  const base = { activo: true, inicia: "2026-09-01T00:00:00Z", termina: null as string | null };
  assert.equal(discountStatus({ ...base, activo: false }, NOW), "inactivo");
  assert.equal(discountStatus({ ...base, inicia: "2026-10-02T00:00:00Z" }, NOW), "programado");
  assert.equal(discountStatus(base, NOW), "vigente");
  assert.equal(discountStatus({ ...base, termina: "2026-10-05T00:00:00Z" }, NOW), "vigente");
  assert.equal(discountStatus({ ...base, termina: "2026-09-30T00:00:00Z" }, NOW), "vencido");
  assert.equal(discountStatus({ ...base, termina: "2026-10-01T12:00:00Z" }, NOW), "vencido", "termina a la hora exacta: ya venció");
  assert.equal(discountStatus({ activo: false, inicia: "2026-10-02T00:00:00Z", termina: null }, NOW), "inactivo", "apagado manda sobre fechas");
});

test("las fechas se escriben en hora de Ecuador (UTC-5)", () => {
  assert.equal(localToIso("2026-10-05T14:30"), "2026-10-05T19:30:00.000Z");
  assert.equal(localToIso("2026-01-01T00:00"), "2026-01-01T05:00:00.000Z");
  assert.equal(isoToLocal("2026-10-05T19:30:00.000Z"), "2026-10-05T14:30");
  assert.equal(isoToLocal(localToIso("2026-12-31T23:59")!), "2026-12-31T23:59", "ida y vuelta");
});

test("fechas mal escritas se rechazan", () => {
  for (const bad of ["", "2026-10-05", "05/10/2026 14:30", "2026-13-01T10:00", "2026-10-05T25:00", "mañana"]) {
    assert.equal(localToIso(bad), null, bad);
  }
});

test("etiqueta del valor", () => {
  assert.equal(discountValueLabel("porcentaje", 15), "15 %");
  assert.equal(discountValueLabel("porcentaje", 12.5), "12,5 %");
  assert.match(discountValueLabel("monto_fijo", 5), /5,00.*por unidad/);
});
