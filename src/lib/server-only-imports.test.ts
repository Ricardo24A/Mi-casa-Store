import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// `server-only` hace fallar la compilación si un componente de cliente llega a estos módulos por
// cualquier camino; esta prueba además lo detecta en los imports directos sin compilar.
const SERVER_ONLY = [
  "@/lib/server-env",
  "@/lib/supabase/admin",
  "@/lib/hmac",
  "@/lib/rate-limit",
  "@/lib/recovery-cookie",
  "@/lib/verify-password",
  "@/lib/password-change",
  "@/lib/email/mailer",
  "@/lib/email/notify",
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("ningún componente de cliente importa módulos con secretos del servidor", () => {
  const offenders: string[] = [];
  for (const file of files("src")) {
    const source = readFileSync(file, "utf8");
    if (!/^\s*["']use client["']/.test(source)) continue;
    for (const mod of SERVER_ONLY) if (source.includes(`from "${mod}"`)) offenders.push(`${file} → ${mod}`);
  }
  assert.deepEqual(offenders, []);
});

test("los módulos con secretos llevan server-only", () => {
  for (const file of ["src/lib/server-env.ts", "src/lib/supabase/admin.ts", "src/lib/hmac.ts", "src/lib/rate-limit.ts", "src/lib/email/mailer.ts", "src/lib/email/notify.ts"]) {
    assert.match(readFileSync(file, "utf8"), /^import "server-only";/m, file);
  }
  assert.doesNotMatch(readFileSync("src/lib/env.ts", "utf8"), /SERVICE_ROLE/, "env.ts (que llega al proxy) no toca la clave de servicio");
});
