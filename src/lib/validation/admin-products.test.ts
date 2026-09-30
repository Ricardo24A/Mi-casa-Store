import assert from "node:assert/strict";
import { test } from "node:test";
import { priceInput, productFormSchema, stockInput } from "./admin-products.ts";

const CAT = "11111111-1111-4111-8111-111111111111";
const base = { categoryId: CAT, nombre: "Espátula", descripcion: "", precio: "12,50", stock: "10", sku: "", activo: "on", destacado: "" };

test("precio: acepta coma o punto, hasta 2 decimales, mayor que 0", () => {
  assert.equal(priceInput.parse("12,50"), 12.5);
  assert.equal(priceInput.parse(" 36.79 "), 36.79);
  assert.equal(priceInput.parse("1"), 1);
  assert.equal(priceInput.parse("450"), 450, "sin tope práctico");
  for (const bad of ["", "0", "-3", "abc", "1,234", "12.345", "1e3x", "NaN", "100000000"]) {
    assert.equal(priceInput.safeParse(bad).success, false, bad);
  }
});

test("stock: entero de 0 o más", () => {
  assert.equal(stockInput.parse("0"), 0);
  assert.equal(stockInput.parse(" 25 "), 25);
  for (const bad of ["", "-1", "1.5", "abc", "99999999"]) assert.equal(stockInput.safeParse(bad).success, false, bad);
});

test("producto: sku vacío es null y las casillas se leen", () => {
  const p = productFormSchema.parse(base);
  assert.equal(p.sku, null);
  assert.equal(p.activo, true);
  assert.equal(p.destacado, false);
  assert.equal(p.precio, 12.5);
  assert.equal(productFormSchema.parse({ ...base, sku: "COC-ESP-01", destacado: "on" }).sku, "COC-ESP-01");
});

test("producto: nombre y categoría obligatorios", () => {
  assert.equal(productFormSchema.safeParse({ ...base, nombre: "  " }).success, false);
  assert.equal(productFormSchema.safeParse({ ...base, categoryId: "no-es-uuid" }).success, false);
  assert.equal(productFormSchema.safeParse({ ...base, descripcion: "x".repeat(5001) }).success, false);
});
