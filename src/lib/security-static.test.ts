// Guardas ESTÁTICAS de seguridad: se rompen si alguien agrega una acción de administración sin comprobar el
// rol, o HTML crudo/evaluación de texto en la app. Son baratas y complementan las pruebas de ataque en vivo.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Cuerpo de cada `export async function nombre(...) { ... }` de un archivo "use server": nombre → primeras líneas. */
function actionStarts(file: string): Map<string, string> {
  const src = readFileSync(file, "utf8");
  const out = new Map<string, string>();
  for (const m of src.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{([\s\S]{0,400})/g)) out.set(m[1], m[2].split("\n").slice(0, 4).join("\n"));
  return out;
}

test("ninguna parte de la app inserta HTML crudo ni evalúa texto", () => {
  const banned = /dangerouslySetInnerHTML|\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write\(|\beval\(|new Function\(/;
  for (const f of walk("src")) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""), banned, `${f} usa HTML crudo o evaluación`);
  }
});

test("TODA acción de servidor del panel comienza comprobando el rol de administrador (requireAdmin)", () => {
  const files = walk("src/app/(admin)").filter((f) => /actions\.ts$/.test(f));
  assert.ok(files.length >= 6, "no se encontraron las acciones del panel");
  for (const f of files) {
    const actions = actionStarts(f);
    assert.ok(actions.size > 0, f);
    for (const [name, start] of actions) {
      // Las de 2FA (enrolar, verificar, salir) tienen su propia comprobación de sesión; el resto exige requireAdmin primero.
      if (/admin\/actions\.ts$/.test(f.replaceAll("\\", "/"))) {
        assert.match(start, /guardAdminArea\(|getAdminSession\(|createClient\(|requireAdmin\(|signOut/, `${f} ${name}`);
      } else if (/return (\w+)\(/.test(start) && !/await requireAdmin\(\)/.test(start)) {
        // Delega en un auxiliar del mismo archivo: ese auxiliar debe comenzar con requireAdmin().
        const helper = /return (\w+)\(/.exec(start)![1];
        const body = new RegExp(String.raw`async function ${helper}\s*\([^)]*\)[^{]*\{\s*await requireAdmin\(\)`);
        assert.match(readFileSync(f, "utf8"), body, `${f}: ${name} delega en ${helper}(), que debe llamar a requireAdmin() primero`);
      } else {
        assert.match(start, /await requireAdmin\(\)/, `${f}: ${name} debe llamar a requireAdmin() antes que nada`);
      }
    }
  }
});

test("las acciones de la cuenta del cliente exigen sesión de cliente antes de tocar datos", () => {
  const f = "src/app/(tienda)/cuenta/actions.ts";
  for (const [name, start] of actionStarts(f)) {
    if (name === "cerrarSesionCliente") continue; // cerrar sesión no necesita datos
    assert.match(start, /await requireCustomer\(\)/, `${name} debe llamar a requireCustomer()`);
  }
});

test("crearPedido, subirComprobante y las acciones del carrito toman el usuario de la SESIÓN, nunca del navegador", () => {
  const order = readFileSync("src/app/(tienda)/checkout/actions.ts", "utf8");
  assert.match(order, /getAdminSession\(\)/);
  assert.match(order, /p_user_id: user\.id/, "el pedido se crea con el id de la sesión");
  assert.doesNotMatch(order, /p_user_id: (input|parsed\.data)/, "el id de usuario no sale de la entrada");
  const proof = readFileSync("src/app/(tienda)/confirmacion/actions.ts", "utf8");
  assert.match(proof, /getAdminSession\(\)/);
  assert.match(proof, /\.eq\("user_id", session\.userId\)/, "el pedido se busca también por el usuario de la sesión");
  const cart = readFileSync("src/lib/cart-server.ts", "utf8");
  assert.match(cart, /session\.userId !== expected\.data/, "el id que manda la pantalla se compara con el de la sesión");
});

test("el cliente de service_role solo se usa en módulos de servidor (acciones, páginas del panel y bibliotecas server-only)", () => {
  for (const f of walk("src")) {
    const src = readFileSync(f, "utf8");
    if (!/createAdminClient\(/.test(src) || /export function createAdminClient/.test(src)) continue;
    const norm = f.replaceAll("\\", "/");
    // Nunca en un componente de cliente.
    assert.doesNotMatch(src.slice(0, 200), /["']use client["']/, `${norm}: un componente de cliente usa service_role`);
    assert.ok(!norm.startsWith("src/components/") || !/["']use client["']/.test(src), norm);
  }
});
