import assert from "node:assert/strict";
import { test } from "node:test";
import { averageTicket, countIn, stockAlertsSchema, summarySchema } from "./admin-dashboard.ts";

test("el ticket promedio es null sin pedidos y se redondea al centavo", () => {
  assert.equal(averageTicket(0, 0), null);
  assert.equal(averageTicket(100, 0), null);
  assert.equal(averageTicket(100, 3), 33.33);
  assert.equal(averageTicket(50, 2), 25);
  assert.equal(averageTicket(10.01, 2), 5.01); // 5.005 sube al centavo
});

test("countIn devuelve 0 para un estado sin pedidos", () => {
  assert.equal(countIn({ pagado: 4 }, "pagado"), 4);
  assert.equal(countIn({ pagado: 4 }, "enviado"), 0);
  assert.equal(countIn({}, "pagado"), 0);
});

test("el resumen acepta una base vacía y rechaza datos mal formados", () => {
  const empty = { estados: {}, hoy: { pedidos: 0, total: 0 }, mes: { pedidos: 0, total: 0 } };
  assert.equal(summarySchema.safeParse(empty).success, true);
  assert.equal(summarySchema.safeParse({ ...empty, hoy: { pedidos: -1, total: 0 } }).success, false);
  assert.equal(summarySchema.safeParse({ ...empty, mes: { pedidos: "3", total: 0 } }).success, false);
  assert.equal(summarySchema.safeParse({}).success, false);
});

test("las alertas de stock se validan, vacías o con productos", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const empty = { umbral: 5, agotados: { total: 0, items: [] }, poco: { total: 0, items: [] } };
  assert.equal(stockAlertsSchema.safeParse(empty).success, true);
  const full = {
    umbral: 5,
    agotados: { total: 1, items: [{ id: ID, nombre: "A", stock: 0, stock_reservado: 0 }] },
    poco: { total: 1, items: [{ id: ID, nombre: "B", stock: 10, stock_reservado: 8, disponible: 2 }] },
  };
  assert.equal(stockAlertsSchema.safeParse(full).success, true);
  assert.equal(stockAlertsSchema.safeParse({ ...empty, agotados: { total: 1, items: [{ id: "x", nombre: "A", stock: 0, stock_reservado: 0 }] } }).success, false);
});
