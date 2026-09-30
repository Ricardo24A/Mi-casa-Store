import assert from "node:assert/strict";
import { test } from "node:test";
import { previewPrice, type OtherDiscount, type PreviewForm } from "./discount-preview.ts";

const NOW = new Date("2026-10-01T12:00:00Z");
const parents = { sub1: "cat1" };
const product = { id: "p1", category_id: "sub1", precio: 100 };
const form: PreviewForm = { tipo: "porcentaje", valor: "20", alcance: "tienda", targetId: "", inicia: "", termina: "" };
const other = (over: Partial<OtherDiscount> = {}): OtherDiscount => ({
  id: "o1",
  nombre: "Otro",
  tipo: "porcentaje",
  valor: 10,
  alcance: "tienda",
  target_id: null,
  codigo: null,
  inicia: "2026-09-01T00:00:00Z",
  termina: null,
  activo: true,
  ...over,
});
const run = (over: Partial<PreviewForm> = {}, others: OtherDiscount[] = []) =>
  previewPrice({ form: { ...form, ...over }, product, others, parents, now: NOW });

test("un descuento solo: precio final y aplica", () => {
  const r = run();
  assert.ok(r.kind === "ok");
  assert.equal(r.precioLista, 100);
  assert.equal(r.conEste, 80);
  assert.equal(r.sinEste, 100);
  assert.equal(r.aplica, true);
  assert.equal(r.fueraDeAlcance, false);
});

test("acumulación: no se suman, gana el que más rebaja", () => {
  // Otro del 30% le gana a este del 20%
  const lose = run({}, [other({ valor: 30 })]);
  assert.ok(lose.kind === "ok");
  assert.equal(lose.aplica, false);
  assert.equal(lose.conEste, 70);
  assert.equal(lose.sinEste, 70);
  assert.deepEqual(lose.ganador, { id: "o1", nombre: "Otro" });

  // Uno del 10% pierde contra este del 20% (y nunca 100 - 10% - 20%)
  const win = run({}, [other({ valor: 10 })]);
  assert.ok(win.kind === "ok");
  assert.equal(win.aplica, true);
  assert.equal(win.conEste, 80);
  assert.equal(win.sinEste, 90);
});

test("monto fijo contra porcentaje: se compara la rebaja real en dólares", () => {
  const r = run({ tipo: "monto_fijo", valor: "25" }, [other({ valor: 20 })]);
  assert.ok(r.kind === "ok");
  assert.equal(r.aplica, true);
  assert.equal(r.conEste, 75);
});

test("nunca deja el producto gratis", () => {
  const r = run({ tipo: "monto_fijo", valor: "500" });
  assert.ok(r.kind === "ok");
  assert.equal(r.conEste, 0.01);
});

test("alcance: por categoría y por producto solo tocan a los suyos", () => {
  const same = run({ alcance: "categoria", targetId: "cat1" }); // el padre de sub1
  assert.ok(same.kind === "ok");
  assert.equal(same.fueraDeAlcance, false);
  assert.equal(same.conEste, 80);

  const otherCat = run({ alcance: "categoria", targetId: "cat2" });
  assert.ok(otherCat.kind === "ok");
  assert.equal(otherCat.fueraDeAlcance, true);
  assert.equal(otherCat.conEste, 100);
  assert.equal(otherCat.aplica, false);

  const otherProd = run({ alcance: "producto", targetId: "p2" });
  assert.ok(otherProd.kind === "ok");
  assert.equal(otherProd.fueraDeAlcance, true);
});

test("vigencia: programado y vencido se avisan y se calculan como si estuvieran vigentes", () => {
  const future = run({ inicia: "2026-10-10T00:00" });
  assert.ok(future.kind === "ok");
  assert.equal(future.vigencia, "programado");
  assert.equal(future.conEste, 80);

  const expired = run({ inicia: "2026-09-01T00:00", termina: "2026-09-02T00:00" });
  assert.ok(expired.kind === "ok");
  assert.equal(expired.vigencia, "vencido");
  assert.equal(expired.conEste, 80);

  const current = run({ inicia: "2026-09-01T00:00", termina: "2026-12-01T00:00" });
  assert.ok(current.kind === "ok");
  assert.equal(current.vigencia, "vigente");
});

test("formularios incompletos o inválidos no producen vista previa", () => {
  for (const over of [{ valor: "" }, { valor: "abc" }, { valor: "0" }, { valor: "100" }, { alcance: "producto" as const }, { inicia: "x" }]) {
    assert.deepEqual(run(over), { kind: "incompleto" }, JSON.stringify(over));
  }
});

test("los descuentos apagados, con cupón o vencidos de los demás no cuentan", () => {
  const ignored = run({}, [
    other({ valor: 50, activo: false }),
    other({ id: "o2", valor: 50, codigo: "X123" }),
    other({ id: "o3", valor: 50, termina: "2026-09-02T00:00:00Z" }),
  ]);
  assert.ok(ignored.kind === "ok");
  assert.equal(ignored.sinEste, 100);
  assert.equal(ignored.aplica, true);
});
