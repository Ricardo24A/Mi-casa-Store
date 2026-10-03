// F22-F23. Sesión y contraseña con cuentas de prueba: la cookie mc_recuperacion falsificada, cambiar la contraseña
// sin la actual, con límite de intentos, y enlaces de correo inválidos. NUNCA se cambia la contraseña de las
// cuentas de prueba: todos los intentos usan una contraseña actual incorrecta o ninguna.
// (Cerrar sesión se prueba aparte, en zz-logout.test.mjs, porque revoca las sesiones de la cuenta.)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ANON, APP_URL, NO_ACCOUNTS, PREFIX, SUPABASE_URL, appUp, assertDevOnly, callAction, check, form, haveService, installSummary, rec, trySession } from "./lib.mjs";

installSummary("F22-F23. Contraseña y cookie de recuperación");
const c1 = await trySession("c1");
const c2 = await trySession("c2");
const up = await appUp();
const skip = (!c1 || !c2 || !up) && (!up ? "no hay servidor local" : NO_ACCOUNTS);
if (!skip) assertDevOnly();

const NEW = "Zz-sec-NuevaClave-12345";
const future = Date.now() + 10 * 60 * 1000;
const changeFor = (cookie, fields) => callAction("guardarNuevaClave", [{}, form({ password: NEW, confirm: NEW, ...fields })], { cookie });
const stillWorks = async (s) => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: s.email, password: process.env[s.who === "c1" ? "ATTACK_CUSTOMER_PASSWORD" : "ATTACK_CUSTOMER2_PASSWORD"] }) });
  return r.status === 200;
};

describe("F22. cookie mc_recuperacion falsificada, de otro usuario, vencida o mal formada", { skip }, () => {
  test("ninguna permite cambiar la contraseña sin la actual", async () => {
    const forged = [
      ["texto cualquiera", "garbage"],
      ["vacía", ""],
      ["firma inventada, usuario y vencimiento correctos", `${c1.userId}.${future}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`],
      ["firma inventada, de otro usuario (cliente 2)", `${c2.userId}.${future}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`],
      ["vencida", `${c1.userId}.1000.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`],
      ["solo dos partes", `${c1.userId}.${future}`],
      ["cuatro partes", `${c1.userId}.${future}.a.b`],
      ["400 caracteres", "A".repeat(400)],
      ["vencimiento no numérico", `${c1.userId}.mañana.AAAA`],
      ["la cookie de sesión de otro usuario copiada como recuperación", c2.cookie.split("; ")[0].split("=")[1] ?? "x"],
    ];
    for (const [label, value] of forged) {
      const cookie = `${c1.cookie}; mc_recuperacion=${value}`;
      const noCurrent = await changeFor(cookie, {});
      const wrongCurrent = await changeFor(cookie, { current: "Incorrecta-zz-sec-1" });
      const changed = (r) => r.redirect && /\/login/.test(r.redirect);
      check(assert, "F22", `cookie ${label}: sin contraseña actual`, "exige la contraseña actual", `${noCurrent.value?.fieldErrors?.current ?? noCurrent.value?.error ?? noCurrent.redirect ?? "?"}`.slice(0, 60), !changed(noCurrent) && Boolean(noCurrent.value?.fieldErrors?.current || noCurrent.value?.error));
      check(assert, "F22", `cookie ${label}: con una actual incorrecta`, "rechazada", `${wrongCurrent.value?.fieldErrors?.current ?? wrongCurrent.value?.error ?? wrongCurrent.redirect ?? "?"}`.slice(0, 60), !changed(wrongCurrent));
    }
    check(assert, "F22", "la contraseña del cliente 1 sigue funcionando", "sigue igual", String(await stillWorks(c1)), await stillWorks(c1));
  });

  test("enlaces de correo inventados, usados o sin token no abren sesión ni dan cookie", async () => {
    for (const qs of ["token_hash=zz-sec&type=recovery", "code=zz-sec&tipo=recovery", "token_hash=&type=recovery", "type=recovery", "token_hash=zz&type=magiclink", "token_hash=zz&type=signup", "code=" + "a".repeat(2000)]) {
      const r = await fetch(`${APP_URL}/cuenta/confirmar?${qs}`, { redirect: "manual" });
      const setCookie = (r.headers.getSetCookie?.() ?? []).join(";");
      check(assert, "F22", `/cuenta/confirmar?${qs.slice(0, 40)}`, "→ /login?error=enlace y sin cookie de recuperación", `${r.status} → ${r.headers.get("location") ?? ""}${/mc_recuperacion/.test(setCookie) ? " (DA COOKIE)" : ""}`, /\/login\?error=enlace/.test(r.headers.get("location") ?? "") && !/mc_recuperacion/.test(setCookie));
    }
    rec("F22", "reutilizar un enlace de recuperación o de confirmación ya usado", "rechazado", "no probado: exige un enlace real enviado por correo (un solo uso lo garantiza Supabase Auth); se puede repetir a mano", "bloqueado");
  });
});

describe("F23. cambiar la contraseña sin la actual, con sesión de otro y con ráfagas", { skip }, () => {
  test("sin sesión: la acción responde que la sesión venció", async () => {
    const r = await changeFor(undefined, { current: "x-zz-sec-1" });
    check(assert, "F23", "guardarNuevaClave sin sesión", "Tu sesión venció", JSON.stringify(r.value).slice(0, 60), /sesión venció/.test(r.value?.error ?? "") && !r.redirect);
  });
  test("con sesión pero sin la actual, o con una actual de OTRA cuenta: se rechaza", async () => {
    const none = await changeFor(c1.cookie, {});
    check(assert, "F23", "sin contraseña actual", "Escribe tu contraseña actual", JSON.stringify(none.value?.fieldErrors ?? none.value).slice(0, 60), Boolean(none.value?.fieldErrors?.current) && !none.redirect);
    const other = await changeFor(c1.cookie, { current: process.env.ATTACK_CUSTOMER2_PASSWORD });
    check(assert, "F23", "la contraseña actual del cliente 2 en la sesión del cliente 1", "rechazada", JSON.stringify(other.value?.fieldErrors ?? other.value).slice(0, 60), !other.redirect && Boolean(other.value?.fieldErrors?.current || other.value?.error));
    check(assert, "F23", "las dos contraseñas siguen intactas", "sin cambios", `${await stillWorks(c1)} / ${await stillWorks(c2)}`, (await stillWorks(c1)) && (await stillWorks(c2)));
  });
  test("ráfaga de intentos con una actual incorrecta: límite de 5 cada 15 minutos por usuario", async () => {
    const msgs = [];
    for (let i = 0; i < 8; i++) {
      const r = await changeFor(c2.cookie, { current: `Incorrecta-zz-sec-${i}` });
      msgs.push(r.value?.fieldErrors?.current ?? r.value?.error ?? "?");
    }
    const limited = msgs.findIndex((m) => /Demasiados intentos/.test(m));
    check(assert, "F23", "8 intentos con contraseña actual incorrecta (cliente 2)", "bloqueo desde el 6.º", limited >= 0 ? `bloqueado en el intento ${limited + 1}` : "nunca se bloqueó", limited >= 0 && limited <= 5);
    check(assert, "F23", "la contraseña del cliente 2 sigue funcionando", "sigue igual", String(await stillWorks(c2)), await stillWorks(c2));
    // El bloqueo dura 15 minutos para esta cuenta de prueba (se vence solo).
    rec("F23", "efecto secundario", "informativo", "el cliente 2 no podrá cambiar su contraseña desde la app durante ~15 min", "ok");
  });
  test("enumeración con cuentas de prueba: recuperar contraseña de una cuenta que existe y de una que no responde igual", { skip: !haveService }, async () => {
    const T = "XXXX.DUMMY.TOKEN.XXXX";
    const a = await callAction("solicitarRecuperacion", [{}, form({ email: c1.email, "cf-turnstile-response": T })]);
    const b = await callAction("solicitarRecuperacion", [{}, form({ email: `${PREFIX}noexiste-${Date.now().toString(36)}@example.com`, "cf-turnstile-response": T })]);
    check(assert, "E20", "recuperar: cuenta existente vs inexistente", "mismo mensaje", `${JSON.stringify(a.value).slice(0, 60)} | ${JSON.stringify(b.value).slice(0, 60)}`, a.value?.ok === b.value?.ok && a.value?.ok !== undefined && a.value?.error === b.value?.error);
    const l1 = await callAction("iniciarSesion", [{}, form({ email: c1.email, password: "Incorrecta-zz-sec-9", "cf-turnstile-response": T })]);
    const l2 = await callAction("iniciarSesion", [{}, form({ email: `${PREFIX}noexiste2-${Date.now().toString(36)}@example.com`, password: "Incorrecta-zz-sec-9", "cf-turnstile-response": T })]);
    check(assert, "E20", "login con contraseña errónea: cuenta existente vs inexistente", "mismo mensaje", `${l1.value?.error} | ${l2.value?.error}`, Boolean(l1.value?.error) && l1.value.error === l2.value?.error);
  });
});
