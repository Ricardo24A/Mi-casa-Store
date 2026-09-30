import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCT_IMAGE_MAX_BYTES, PROOF_MAX_BYTES, checkImageBytes, checkProofBytes, sniffMime } from "./files.ts";

const bytes = (...b: number[]) => Uint8Array.from(b);
const pad = (head: number[], total: number) => {
  const out = new Uint8Array(total);
  out.set(head);
  return out;
};

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

test("acepta JPG, PNG y PDF por su contenido real", () => {
  assert.deepEqual(checkProofBytes(pad(JPEG, 100)), { ok: true, mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(checkProofBytes(pad(PNG, 100)), { ok: true, mime: "image/png", extension: "png" });
  assert.deepEqual(checkProofBytes(pad(PDF, 100)), { ok: true, mime: "application/pdf", extension: "pdf" });
});

test("rechaza lo que no es JPG, PNG o PDF aunque sea una imagen válida (WebP, GIF)", () => {
  assert.equal(sniffMime(pad(WEBP, 100)), "image/webp");
  assert.equal(checkProofBytes(pad(WEBP, 100)).ok, false);
  assert.equal(checkProofBytes(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 100)).ok, false);
});

test("rechaza ejecutables, scripts y HTML disfrazados (el nombre no cuenta)", () => {
  assert.equal(checkProofBytes(bytes(0x4d, 0x5a, 0x90, 0x00)).ok, false); // .exe
  assert.equal(checkProofBytes(new TextEncoder().encode("<script>alert(1)</script>")).ok, false);
  assert.equal(checkProofBytes(new TextEncoder().encode("<html></html>")).ok, false);
  assert.equal(checkProofBytes(new TextEncoder().encode("#!/bin/sh\nrm -rf /")).ok, false);
});

test("rechaza archivos vacíos y demasiado grandes", () => {
  assert.equal(checkProofBytes(new Uint8Array(0)).ok, false);
  assert.equal(checkProofBytes(pad(JPEG, PROOF_MAX_BYTES)).ok, true, "justo en el límite");
  assert.equal(checkProofBytes(pad(JPEG, PROOF_MAX_BYTES + 1)).ok, false, "un byte de más");
});

test("el límite de comprobantes es 4 MB", () => {
  assert.equal(PROOF_MAX_BYTES, 4 * 1024 * 1024);
});

test("imágenes de productos: acepta JPG, PNG y WebP por su contenido real", () => {
  assert.deepEqual(checkImageBytes(pad(JPEG, 100)), { ok: true, mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(checkImageBytes(pad(PNG, 100)), { ok: true, mime: "image/png", extension: "png" });
  assert.deepEqual(checkImageBytes(pad(WEBP, 100)), { ok: true, mime: "image/webp", extension: "webp" });
});

test("imágenes de productos: rechaza PDF, GIF, SVG, HTML y ejecutables", () => {
  assert.equal(checkImageBytes(pad(PDF, 100)).ok, false);
  assert.equal(checkImageBytes(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 100)).ok, false);
  assert.equal(checkImageBytes(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>")).ok, false);
  assert.equal(checkImageBytes(new TextEncoder().encode("<html></html>")).ok, false);
  assert.equal(checkImageBytes(bytes(0x4d, 0x5a, 0x90, 0x00)).ok, false);
});

test("imágenes de productos: vacío y más de 4 MB se rechazan; el límite exacto pasa", () => {
  assert.equal(PRODUCT_IMAGE_MAX_BYTES, 4 * 1024 * 1024);
  assert.equal(checkImageBytes(new Uint8Array(0)).ok, false);
  assert.equal(checkImageBytes(pad(JPEG, PRODUCT_IMAGE_MAX_BYTES)).ok, true);
  assert.equal(checkImageBytes(pad(JPEG, PRODUCT_IMAGE_MAX_BYTES + 1)).ok, false);
});
