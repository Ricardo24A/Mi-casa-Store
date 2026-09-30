// Decisión de acceso al dashboard. Función pura: la usan el proxy (primera barrera) y
// `requireAdmin()` (barrera de cada página y acción), así ambos deciden exactamente igual.
// Sin `server-only` a propósito: el proxy y las pruebas la importan directamente.

import { safeNext } from "./safe-next.ts";

export const ADMIN_HOME = "/admin";
/** Login único de clientes y administrador. /admin/login solo redirige aquí. */
export const ADMIN_LOGIN = "/login";
export const ADMIN_ENROLL = "/admin/2fa";
export const ADMIN_VERIFY = "/admin/verificar";

/** Zona del dashboard a la que pertenece una ruta. */
export type AdminArea = "login" | "enrolar" | "verificar" | "panel";

export interface AdminAccessState {
  /** null = sin sesión. */
  userId: string | null;
  role: "admin" | "customer" | null;
  /** Nivel de la sesión: aal1 = solo contraseña, aal2 = contraseña + código TOTP. */
  aal: "aal1" | "aal2" | null;
  /** ¿Tiene al menos un factor TOTP ya verificado? */
  hasVerifiedFactor: boolean;
}

export function areaForPath(pathname: string): AdminArea {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  // /admin/login ya no tiene formulario propio: redirige al login único (config de redirects).
  if (path === "/admin/login") return "login";
  if (path === ADMIN_ENROLL) return "enrolar";
  if (path === ADMIN_VERIFY) return "verificar";
  return "panel";
}

/**
 * A dónde mandar al visitante, o null si puede ver la zona.
 *
 * - `panel`: exige admin con aal2.
 * - `enrolar` / `verificar`: exigen admin (aal1 basta). Con aal2, `enrolar` sigue permitido
 *   para registrar un dispositivo adicional; `verificar` y `login` ya no tienen sentido.
 * - Cualquier ruta salvo `login` sin sesión va a `login`. Un usuario que no es admin va a la tienda.
 */
export function adminRedirect(area: AdminArea, state: AdminAccessState): string | null {
  if (!state.userId) return area === "login" ? null : ADMIN_LOGIN;
  if (state.role !== "admin") return area === "login" ? null : "/";

  if (state.aal === "aal2") {
    if (area === "login" || area === "verificar") return ADMIN_HOME;
    return null;
  }

  // Admin con solo contraseña (aal1) o sin nivel legible: hay que pasar el segundo factor.
  // Con un factor ya verificado se verifica; sin factor se enrola. No se puede enrolar otro
  // factor sin haber pasado aal2, ni verificar sin tener uno.
  const target = state.hasVerifiedFactor ? ADMIN_VERIFY : ADMIN_ENROLL;
  if (area === "verificar" && target === ADMIN_VERIFY) return null;
  if (area === "enrolar" && target === ADMIN_ENROLL) return null;
  return target;
}

// ---------------------------------------------------------------------------
// Cuenta de clientes (/cuenta). Separada del dashboard: los roles no se mezclan.
// ---------------------------------------------------------------------------

export const ACCOUNT_HOME = "/cuenta";
export const ACCOUNT_LOGIN = "/login";

/** `acceso`: pantallas del login único (login, registro, recuperar). `panel`: /cuenta. */
export type AccountArea = "acceso" | "panel";

/**
 * A dónde mandar al visitante, o null si puede ver la zona.
 *
 * - `acceso`: sin sesión se ve el formulario. Un cliente con sesión va a su cuenta. Un admin con
 *   sesión va al paso de 2FA que le falta (o al panel si ya es aal2): decide `adminRedirect`.
 * - `panel` (/cuenta): solo un `customer`. Un admin va al dashboard, donde se le exige el 2FA.
 * - Un cliente jamás entra a /admin (lo decide `adminRedirect`, que lo manda a la tienda).
 */
export function accountRedirect(area: AccountArea, state: AdminAccessState): string | null {
  if (!state.userId || state.role === null) return area === "acceso" ? null : ACCOUNT_LOGIN;
  if (state.role === "admin") return area === "acceso" ? adminRedirect("login", state) : ADMIN_HOME;
  // customer
  return area === "acceso" ? ACCOUNT_HOME : null;
}

/**
 * Destino tras validar la contraseña en el login único.
 * - customer: el `next` solo si pasa `safeNext`; si no, el home.
 * - admin: siempre /admin. Ahí el proxy le pide registrar o verificar el 2FA: con solo la
 *   contraseña (aal1) nunca obtiene el panel. El `next` se ignora.
 * - cualquier otro caso (sin perfil, rol desconocido): null = rechazar el acceso.
 */
export function postLoginDestination(role: string | null | undefined, next: unknown): string | null {
  if (role === "customer") return safeNext(next, "/");
  if (role === "admin") return ADMIN_HOME;
  return null;
}
