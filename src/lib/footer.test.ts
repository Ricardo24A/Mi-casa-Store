import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/components/store/footer.tsx", "utf8");

test("el pie tiene cuatro columnas, en este orden: marca, Tienda, Categorías, Información", () => {
  const brand = source.indexOf("titleClass}>{info.nombre}");
  const shop = source.indexOf('aria-label="Tienda"');
  const categories = source.indexOf('aria-label="Categorías del pie"');
  const info = source.indexOf('aria-label="Información legal"');
  assert.ok(brand > 0 && shop > brand && categories > shop && info > categories, "orden de columnas");
});

test("una sola fila de 4 columnas en escritorio, 2 en tablet y 1 en celular, alineadas por arriba", () => {
  const grid = /className="([^"]*grid[^"]*)"/.exec(source)?.[1] ?? "";
  assert.match(grid, /\blg:grid-cols-4\b/);
  assert.match(grid, /\bmd:grid-cols-2\b/);
  assert.doesNotMatch(grid, /(^|\s)grid-cols-/, "en celular, una columna (sin grid-cols base)");
  assert.match(grid, /\bitems-start\b/);
});

test("los títulos de las columnas comparten la jerarquía del nombre de la marca", () => {
  const uses = source.match(/className=\{titleClass\}/g) ?? [];
  assert.equal(uses.length, 4, "marca, Tienda, Categorías e Información");
  assert.match(source, /const titleClass = "text-lg font-semibold leading-7"/);
});

test("Tienda e Información llevan los enlaces esperados, todos a páginas que existen", () => {
  const shop = source.slice(source.indexOf('aria-label="Tienda"'), source.indexOf('aria-label="Categorías del pie"'));
  assert.deepEqual([...shop.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ["/catalogo", "/carrito", "/contacto"]);
  for (const href of ["/catalogo", "/carrito", "/contacto"]) assert.ok(existsSync(`src/app/(tienda)${href}/page.tsx`), href);
  assert.match(source, /LEGAL_LINKS\.map/);
  const legal = readFileSync("src/content/legal/index.ts", "utf8");
  assert.deepEqual([...legal.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]), ["/privacidad", "/terminos", "/cookies"]);
  for (const href of ["/privacidad", "/terminos", "/cookies"]) assert.ok(existsSync(`src/app/(tienda)${href}/page.tsx`), href);
});

test("Categorías sale de las categorías visibles y apunta a /categoria/[slug]", () => {
  assert.match(source, /getCategoryTree\(\)/);
  assert.match(source, /categories\.map\(\(cat\) =>/);
  assert.match(source, /href=\{`\/categoria\/\$\{cat\.slug\}`\}/);
  assert.ok(existsSync("src/app/(tienda)/categoria/[slug]/page.tsx"));
});

test("los enlaces tienen 44 px en celular y todos comparten el mismo estilo (y el mismo foco)", () => {
  assert.match(source, /const linkClass =\s*"[^"]*min-h-11[^"]*md:min-h-8"/);
  const links = source.match(/className=\{linkClass\}/g) ?? [];
  assert.ok(links.length === 7, "teléfono, correo, 3 de Tienda y los dos listados (categorías y legales) usan linkClass");
  assert.doesNotMatch(source, /outline-none|focus:outline-none|focus-visible:outline-none/, "no se quita el foco del teclado");
});

test("el pie no se imprime", () => {
  assert.match(source, /<footer className="[^"]*print:hidden/);
  assert.match(source, /<footer aria-busy="true" className="[^"]*print:hidden/);
});
