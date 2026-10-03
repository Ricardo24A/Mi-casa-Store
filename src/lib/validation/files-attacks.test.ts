// Pruebas de ATAQUE a la validación de archivos (comprobantes e imágenes). La regla es: solo cuenta lo que
// dicen los PRIMEROS BYTES; el nombre y el tipo que declara el navegador no se leen. Lo que NO detecta la
// validación (polyglots, PDF con scripts) se deja documentado aquí con su mitigación.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PROOF_MAX_BYTES, checkImageBytes, checkProofBytes, sniffMime } from "./files.ts";

const enc = (s: string) => new TextEncoder().encode(s);
const cat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("rechaza SVG (con o sin cabecera XML), HTML, JS, PHP, ejecutables y comprimidos", () => {
  const bad = [
    enc(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>`),
    enc(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>`),
    enc(`﻿<svg></svg>`),
    enc(`<!DOCTYPE html><html><script>alert(1)</script></html>`),
    enc(`<script>alert(1)</script>`),
    enc(`<?php system($_GET["c"]); ?>`),
    enc(`alert(1)`),
    Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), // MZ (.exe)
    Uint8Array.from([0x7f, 0x45, 0x4c, 0x46]), // ELF
    Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), // ZIP / docx / jar
    Uint8Array.from([0x1f, 0x8b, 0x08]), // gzip
    Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF
    Uint8Array.from([0x42, 0x4d, 0x00, 0x00]), // BMP
  ];
  for (const b of bad) {
    assert.equal(checkProofBytes(b).ok, false);
    assert.equal(checkImageBytes(b).ok, false);
  }
});

test("la firma debe estar AL PRINCIPIO: texto delante de una firma válida se rechaza", () => {
  assert.equal(checkProofBytes(cat(enc("<html>"), JPEG)).ok, false);
  assert.equal(checkProofBytes(cat(enc("\n"), PNG)).ok, false);
  assert.equal(checkProofBytes(cat(enc(" %PDF-1.4"))).ok, false);
});

test("firmas truncadas o de otro formato parecido", () => {
  assert.equal(sniffMime(Uint8Array.from([0xff, 0xd8])), null, "JPEG truncado");
  assert.equal(sniffMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), null, "PNG truncado");
  assert.equal(sniffMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0])), null, "RIFF sin WEBP");
  assert.equal(sniffMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])), null, "RIFF/WAVE no es WebP");
});

test("lo que la validación NO puede ver (documentado): un JPEG o PNG con HTML/JS al final pasa, pero se sirve como imagen", () => {
  // Un polyglot es una imagen válida con texto extra. La firma es correcta, así que pasa. La mitigación es
  // de despliegue: se sube con contentType de imagen, el archivo no se sirve desde el origen de la tienda
  // (comprobantes: bucket privado con URL firmada; imágenes: dominio de Supabase con nosniff) y se muestra
  // con <img>, nunca como documento. Este test fija el comportamiento para que un cambio sea consciente.
  assert.equal(checkProofBytes(cat(JPEG, enc("<script>alert(1)</script>"))).ok, true);
  assert.equal(checkProofBytes(cat(PNG, enc("<html><script>alert(1)</script></html>"))).ok, true);
  // PDF con JavaScript: tiene firma de PDF, pasa. Se abre en otra pestaña desde otro origen (Supabase).
  assert.equal(checkProofBytes(enc("%PDF-1.4\n1 0 obj<</Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj")).ok, true);
});

test("tamaños: vacío, un byte, exactamente el límite y uno más", () => {
  assert.equal(checkProofBytes(new Uint8Array(0)).ok, false);
  assert.equal(checkProofBytes(Uint8Array.from([0xff])).ok, false);
  const at = (n: number) => {
    const b = new Uint8Array(n);
    b.set(JPEG);
    return b;
  };
  assert.equal(checkProofBytes(at(PROOF_MAX_BYTES)).ok, true);
  assert.equal(checkProofBytes(at(PROOF_MAX_BYTES + 1)).ok, false);
  assert.equal(checkProofBytes(at(PROOF_MAX_BYTES * 3)).ok, false);
});

test("el servidor nunca usa el nombre ni el tipo declarado del archivo", () => {
  for (const f of ["src/app/(tienda)/confirmacion/actions.ts", "src/app/(admin)/admin/(panel)/productos/actions.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /file\.name|\.name\s*\.(split|slice|replace|match)/, `${f}: no usa el nombre del archivo`);
    assert.doesNotMatch(src, /file\.type|\.type\s*===/, `${f}: no usa el tipo que declara el navegador`);
  }
  const proof = readFileSync("src/app/(tienda)/confirmacion/actions.ts", "utf8");
  assert.match(proof, /randomUUID\(\)\}\.\$\{check\.extension\}/, "el nombre en el bucket lo genera el servidor");
  assert.match(proof, /file\.size > PROOF_MAX_BYTES/, "el tamaño se mira antes de leer el archivo en memoria");
});

test("las rutas del bucket se arman solo con identificadores del servidor (sin ../ ni nombres del usuario)", () => {
  const proof = readFileSync("src/app/(tienda)/confirmacion/actions.ts", "utf8");
  assert.match(proof, /const path = `\$\{session\.userId\}\/\$\{order\.id\}\//);
  const images = readFileSync("src/app/(admin)/admin/(panel)/productos/actions.ts", "utf8");
  assert.match(images, /`productos\/\$\{id\.data\}`/);
  assert.match(images, /`categorias\/\$\{id\.data\}`/);
});
