import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Toda página del panel (/admin, grupo (panel)) debe:
//  - llamar a requireAdmin() (cada página es una barrera; el layout no lo es), y
//  - exportar `instant = false` (panel privado, sin armazón instantáneo: ver el comentario en cada página).
// Así una página nueva que se olvide de cualquiera de las dos hace fallar `npm test`.
const PANEL = "src/app/(admin)/admin/(panel)";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? pages(path) : name === "page.tsx" ? [path] : [];
  });
}

test("hay páginas del panel que revisar", () => {
  assert.ok(pages(PANEL).length >= 15);
});

test("cada página del panel llama a requireAdmin() y exporta instant = false", () => {
  const missing: string[] = [];
  for (const file of pages(PANEL)) {
    const source = readFileSync(file, "utf8");
    if (!/await requireAdmin\(\)/.test(source)) missing.push(`${file}: falta await requireAdmin()`);
    if (!/^export const instant = false;$/m.test(source)) missing.push(`${file}: falta export const instant = false`);
  }
  assert.deepEqual(missing, []);
});

test("las pantallas de 2FA no se tocan: sin instant y con su propia comprobación", () => {
  for (const file of ["src/app/(admin)/admin/(acceso)/2fa/page.tsx", "src/app/(admin)/admin/(acceso)/verificar/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /export const instant/, file);
    assert.match(source, /guardAdminArea\(/, file);
  }
});
