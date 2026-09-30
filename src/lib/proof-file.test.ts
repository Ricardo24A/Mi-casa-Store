import assert from "node:assert/strict";
import { test } from "node:test";
import { fitWithin } from "./proof-file.ts";

test("fitWithin reduce el lado mayor y conserva la proporción", () => {
  assert.deepEqual(fitWithin(4000, 3000, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin(3000, 4000, 2000), { width: 1500, height: 2000 });
});

test("fitWithin nunca agranda una imagen pequeña", () => {
  assert.deepEqual(fitWithin(800, 600, 2000), { width: 800, height: 600 });
});

test("fitWithin no produce tamaños de 0 píxeles", () => {
  const r = fitWithin(10000, 1, 2000);
  assert.ok(r.width >= 1 && r.height >= 1);
});
