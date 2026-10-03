import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("las cookies de sesión de Supabase llevan Secure en producción (la biblioteca no lo hace sola)", () => {
  for (const f of ["src/lib/supabase/server.ts", "src/proxy.ts"]) {
    assert.match(readFileSync(f, "utf8"), /cookieOptions:\s*\{\s*secure:\s*process\.env\.NODE_ENV === "production"\s*\}/, f);
  }
});
