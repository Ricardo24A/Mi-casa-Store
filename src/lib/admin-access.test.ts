import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_ENROLL,
  ADMIN_HOME,
  ADMIN_LOGIN,
  ADMIN_VERIFY,
  adminRedirect,
  areaForPath,
  type AdminAccessState,
} from "./admin-access.ts";

const anon: AdminAccessState = { userId: null, role: null, aal: null, hasVerifiedFactor: false };
const customer: AdminAccessState = { userId: "u", role: "customer", aal: "aal1", hasVerifiedFactor: false };
const adminNoFactor: AdminAccessState = { userId: "a", role: "admin", aal: "aal1", hasVerifiedFactor: false };
const adminAal1: AdminAccessState = { userId: "a", role: "admin", aal: "aal1", hasVerifiedFactor: true };
const adminAal2: AdminAccessState = { userId: "a", role: "admin", aal: "aal2", hasVerifiedFactor: true };

test("areaForPath reconoce las pantallas de acceso y trata el resto como panel", () => {
  assert.equal(areaForPath("/admin/login"), "login");
  assert.equal(areaForPath("/admin/login/"), "login");
  assert.equal(areaForPath("/admin/2fa"), "enrolar");
  assert.equal(areaForPath("/admin/verificar"), "verificar");
  assert.equal(areaForPath("/admin"), "panel");
  assert.equal(areaForPath("/admin/productos/x"), "panel");
  assert.equal(areaForPath("/admin/login-falso"), "panel");
});

test("sin sesión: solo el login es público", () => {
  assert.equal(adminRedirect("login", anon), null);
  for (const area of ["panel", "enrolar", "verificar"] as const) {
    assert.equal(adminRedirect(area, anon), ADMIN_LOGIN);
  }
});

test("un cliente no entra al dashboard", () => {
  for (const area of ["panel", "enrolar", "verificar"] as const) {
    assert.equal(adminRedirect(area, customer), "/");
  }
  assert.equal(adminRedirect("login", customer), null);
});

test("admin sin factor: todo lleva a enrolar", () => {
  assert.equal(adminRedirect("enrolar", adminNoFactor), null);
  assert.equal(adminRedirect("panel", adminNoFactor), ADMIN_ENROLL);
  assert.equal(adminRedirect("verificar", adminNoFactor), ADMIN_ENROLL);
  assert.equal(adminRedirect("login", adminNoFactor), ADMIN_ENROLL);
});

test("admin con factor pero en aal1: todo lleva a verificar el código", () => {
  assert.equal(adminRedirect("verificar", adminAal1), null);
  assert.equal(adminRedirect("panel", adminAal1), ADMIN_VERIFY);
  assert.equal(adminRedirect("enrolar", adminAal1), ADMIN_VERIFY);
  assert.equal(adminRedirect("login", adminAal1), ADMIN_VERIFY);
});

test("admin en aal2: entra al panel y puede registrar otro dispositivo", () => {
  assert.equal(adminRedirect("panel", adminAal2), null);
  assert.equal(adminRedirect("enrolar", adminAal2), null);
  assert.equal(adminRedirect("login", adminAal2), ADMIN_HOME);
  assert.equal(adminRedirect("verificar", adminAal2), ADMIN_HOME);
});

test("un nivel ilegible (null) se trata como aal1", () => {
  const state: AdminAccessState = { ...adminAal1, aal: null };
  assert.equal(adminRedirect("panel", state), ADMIN_VERIFY);
});

// ---------------------------------------------------------------------------
// Separación entre la cuenta de clientes y el dashboard
// ---------------------------------------------------------------------------
import { ACCOUNT_HOME, ACCOUNT_LOGIN, accountRedirect } from "./admin-access.ts";

test("un cliente nunca entra al dashboard, ni con nivel aal2", () => {
  const customerAal2: AdminAccessState = { userId: "u", role: "customer", aal: "aal2", hasVerifiedFactor: true };
  for (const state of [customer, customerAal2]) {
    for (const area of ["panel", "enrolar", "verificar"] as const) {
      assert.equal(adminRedirect(area, state), "/", `${area} con ${state.aal}`);
    }
  }
});

test("un usuario sin perfil legible (role null) no entra al dashboard", () => {
  const noRole: AdminAccessState = { userId: "u", role: null, aal: "aal2", hasVerifiedFactor: true };
  assert.equal(adminRedirect("panel", noRole), "/");
});

test("un admin que inició sesión por el login de clientes (aal1) no obtiene el panel", () => {
  // Esa sesión es aal1 aunque tenga factor: para /admin sigue pidiéndole el código.
  assert.equal(adminRedirect("panel", adminAal1), ADMIN_VERIFY);
  // Y sin factor, lo manda a enrolar; nunca deja pasar.
  assert.equal(adminRedirect("panel", adminNoFactor), ADMIN_ENROLL);
});

test("cuenta: sin sesión solo se ven las pantallas de acceso", () => {
  assert.equal(accountRedirect("acceso", anon), null);
  assert.equal(accountRedirect("panel", anon), ACCOUNT_LOGIN);
});

test("cuenta: un cliente entra al panel y no vuelve a ver el login", () => {
  assert.equal(accountRedirect("panel", customer), null);
  assert.equal(accountRedirect("acceso", customer), ACCOUNT_HOME);
});

test("cuenta: un admin no usa el panel del cliente, lo envía al dashboard", () => {
  for (const admin of [adminNoFactor, adminAal1, adminAal2]) {
    assert.equal(accountRedirect("panel", admin), ADMIN_HOME);
  }
});

test("login único: un admin ya autenticado avanza al paso de 2FA que le falta", () => {
  assert.equal(accountRedirect("acceso", adminNoFactor), ADMIN_ENROLL);
  assert.equal(accountRedirect("acceso", adminAal1), ADMIN_VERIFY);
  assert.equal(accountRedirect("acceso", adminAal2), ADMIN_HOME);
});

test("cuenta: sesión sin perfil (role null) se trata como sin sesión", () => {
  const noRole: AdminAccessState = { userId: "u", role: null, aal: "aal1", hasVerifiedFactor: false };
  assert.equal(accountRedirect("panel", noRole), ACCOUNT_LOGIN);
});

// ---------------------------------------------------------------------------
// Login único: destino tras validar la contraseña
// ---------------------------------------------------------------------------
import { postLoginDestination } from "./admin-access.ts";

test("login único: un cliente va al home si no hay next", () => {
  assert.equal(postLoginDestination("customer", undefined), "/");
  assert.equal(postLoginDestination("customer", null), "/");
  assert.equal(postLoginDestination("customer", ""), "/");
});

test("login único: un cliente va al next solo si pasa safeNext", () => {
  assert.equal(postLoginDestination("customer", "/checkout"), "/checkout");
  assert.equal(postLoginDestination("customer", "/cuenta/direcciones"), "/cuenta/direcciones");
});

test("login único: un next malicioso se ignora", () => {
  for (const evil of ["https://malo.com", "//malo.com", "/\malo.com", "javascript:alert(1)", "/cuenta/../admin"]) {
    assert.equal(postLoginDestination("customer", evil), "/", evil);
  }
});

test("login único: un cliente nunca recibe /admin como destino, ni con next=/admin", () => {
  for (const next of ["/admin", "/admin/productos", "/admin/login", "/ADMIN"]) {
    const dest = postLoginDestination("customer", next);
    assert.equal(dest, "/", next);
    assert.ok(!dest?.startsWith("/admin"));
  }
});

test("login único: un admin va siempre a /admin y nunca a un next", () => {
  assert.equal(postLoginDestination("admin", undefined), ADMIN_HOME);
  assert.equal(postLoginDestination("admin", "/checkout"), ADMIN_HOME);
  assert.equal(postLoginDestination("admin", "https://malo.com"), ADMIN_HOME);
});

test("login único: un admin con solo la contraseña (aal1) no obtiene el panel", () => {
  // Llega a /admin, pero adminRedirect lo detiene hasta que pase el segundo factor.
  assert.equal(postLoginDestination("admin", null), ADMIN_HOME);
  assert.equal(adminRedirect("panel", adminAal1), ADMIN_VERIFY);
  assert.equal(adminRedirect("panel", adminNoFactor), ADMIN_ENROLL);
  // Solo con aal2 (código TOTP verificado) se abre el panel.
  assert.equal(adminRedirect("panel", adminAal2), null);
});

test("login único: rol desconocido o sin perfil se rechaza", () => {
  for (const role of [null, undefined, "", "superadmin", "Customer"]) {
    assert.equal(postLoginDestination(role, "/checkout"), null, String(role));
  }
});

test("el login único es /login y las rutas sin sesión del dashboard van ahí", () => {
  assert.equal(ADMIN_LOGIN, "/login");
  assert.equal(ACCOUNT_LOGIN, "/login");
  assert.equal(adminRedirect("panel", anon), "/login");
  assert.equal(accountRedirect("panel", anon), "/login");
});
