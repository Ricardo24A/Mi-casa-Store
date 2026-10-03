// F24. Cierre de sesión: tras salir, la cookie vieja y el refresh token ya no funcionan. Se hace al final
// (el nombre del archivo lo deja último) porque cerrar sesión revoca las sesiones de la cuenta de prueba.
// Se usa una sesión NUEVA del cliente 2, no la de las otras pruebas.
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { describe, test } from "node:test";
import { ACCOUNTS, ANON, NO_ACCOUNTS, SUPABASE_URL, appUp, assertDevOnly, callAction, check, getPage, installSummary, rec } from "./lib.mjs";

installSummary("F24. Cierre de sesión");
const up = await appUp();
let fresh = null;
if (up && ACCOUNTS.c2.email) {
  const jar = new Map();
  const sb = createServerClient(SUPABASE_URL, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
  const { data, error } = await sb.auth.signInWithPassword({ email: ACCOUNTS.c2.email, password: ACCOUNTS.c2.password });
  if (!error && data.session) fresh = { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), access: data.session.access_token, refresh: data.session.refresh_token, userId: data.user.id };
}
const skip = (!up || !fresh) && (!up ? "no hay servidor local" : NO_ACCOUNTS);
if (!skip) assertDevOnly();

describe("F24. tras cerrar sesión, lo viejo no sirve", { skip }, () => {
  test("la cookie, el refresh token y la página de cuenta dejan de funcionar", async () => {
    const before = await callAction("obtenerCarrito", [fresh.userId], { cookie: fresh.cookie });
    check(assert, "F24", "control positivo: la sesión nueva funciona", "ok", JSON.stringify(before.value).slice(0, 40), before.value?.ok === true);

    const out = await callAction("cerrarSesionCliente", [], { cookie: fresh.cookie });
    rec("F24", "cerrarSesionCliente", "redirige a /", `${out.status} → ${out.redirect ?? ""}`, "ok");

    const after = await callAction("obtenerCarrito", [fresh.userId], { cookie: fresh.cookie });
    check(assert, "F24", "acción del carrito con la cookie vieja", "code=login (sin sesión)", JSON.stringify(after.value).slice(0, 50), after.value?.ok !== true && after.value?.code === "login");

    const page = await getPage("/cuenta", { cookie: fresh.cookie });
    // Los textos del menú ("Mis pedidos") salen también sin sesión: lo que cuenta es el redirect a /login y que no
    // aparezca ningún dato de la cuenta (su correo).
    const redirected = /http-equiv="refresh"[^>]*url=\/login/.test(page.text) || (page.status >= 300 && page.status < 400);
    const leaks = page.text.includes(ACCOUNTS.c2.email);
    check(assert, "F24", "GET /cuenta con la cookie vieja", "redirige a /login y no muestra datos de la cuenta", `${page.status}${redirected ? " → /login" : ""}${leaks ? " (MUESTRA EL CORREO)" : ""}`, redirected && !leaks);

    const refresh = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: fresh.refresh }) });
    check(assert, "F24", "refresh token viejo", "rechazado", refresh.status, refresh.status >= 400);

    const getUser = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${fresh.access}` } });
    check(assert, "F24", "GET /auth/v1/user con el access token viejo", "rechazado (la sesión ya no existe)", getUser.status, getUser.status >= 400);

    // Informativo: el JWT sigue siendo válido para PostgREST hasta que vence (así funcionan los JWT sin estado).
    const rest = await fetch(`${SUPABASE_URL}/rest/v1/cart_items?select=cantidad&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${fresh.access}` } });
    rec("F24", "API REST con el access token viejo", "informativo: vale hasta vencer (el tiempo lo fija 'JWT expiry' en Supabase)", `${rest.status}`, "ok");
  });
});
