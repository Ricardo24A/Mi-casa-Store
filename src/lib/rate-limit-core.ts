/**
 * Límite de intentos: reglas y decisiones, sin dependencias de servidor (se prueban con node --test).
 * La cuenta la lleva la base de datos (`rate_limit_hit`, migración 21); `rate-limit.ts` la llama.
 */

export interface RateRule {
  /** Nombre del contador en la base (`rate_limits.bucket`). */
  bucket: string;
  /** Intentos permitidos dentro de la ventana. */
  max: number;
  /** Duración de la ventana, en segundos. */
  windowSeconds: number;
}

const MIN = 60;
const HOUR = 60 * MIN;

/**
 * Límites por acción. Por IP son más holgados que por correo o usuario: en Ecuador muchos celulares
 * comparten IP. Los intentos rechazados no suman.
 */
export const RATE_RULES = {
  loginIp: { bucket: "login_ip", max: 30, windowSeconds: 15 * MIN },
  loginEmail: { bucket: "login_email", max: 8, windowSeconds: 15 * MIN },
  registroIp: { bucket: "registro_ip", max: 5, windowSeconds: HOUR },
  registroEmail: { bucket: "registro_email", max: 3, windowSeconds: HOUR },
  recuperarIp: { bucket: "recuperar_ip", max: 5, windowSeconds: HOUR },
  recuperarEmail: { bucket: "recuperar_email", max: 3, windowSeconds: HOUR },
  codigo2fa: { bucket: "codigo_2fa", max: 10, windowSeconds: 15 * MIN },
  cambioClave: { bucket: "cambio_clave", max: 5, windowSeconds: 15 * MIN },
  pedido: { bucket: "pedido", max: 10, windowSeconds: HOUR },
  comprobante: { bucket: "comprobante", max: 10, windowSeconds: HOUR },
} as const satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof RATE_RULES;

/**
 * Qué hacer si la propia función de límite falla (base caída, migración sin aplicar):
 *  - "closed": se rechaza la acción. Para login, registro, cambio de contraseña y pedidos, donde dejar
 *    pasar sin límite abre la puerta a probar contraseñas, crear cuentas falsas o apartar stock.
 *  - "open": se deja pasar. Para recuperar contraseña, código 2FA y comprobantes, que tienen otra
 *    protección (límites de Supabase Auth, tope de 3 comprobantes por pedido) y donde bloquear dejaría
 *    a una persona legítima sin recuperar su cuenta, sin pagar, o al dueño fuera del panel.
 */
export type FailMode = "closed" | "open";

/** allow = sigue; limited = demasiados intentos; unavailable = no se pudo comprobar y la regla es "closed". */
export type RateDecision = "allow" | "limited" | "unavailable";

/** Interpreta la respuesta de `rate_limit_hit` (o una excepción al llamarla). */
export function interpretRateLimit(
  response: { data: unknown; error: unknown } | { thrown: unknown },
  mode: FailMode,
): RateDecision {
  if ("thrown" in response || response.error || typeof response.data !== "boolean") {
    return mode === "closed" ? "unavailable" : "allow";
  }
  return response.data ? "allow" : "limited";
}

/** El primer resultado que no sea "allow" decide (los controles se hacen en orden y se detienen ahí). */
export function firstBlocking(decisions: RateDecision[]): RateDecision {
  return decisions.find((d) => d !== "allow") ?? "allow";
}

/** Mismo correo con otras mayúsculas o espacios = mismo contador. */
export function emailIdentity(email: string): string {
  return email.trim().toLowerCase();
}

export const RATE_LIMITED_MESSAGE = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
export const RATE_UNAVAILABLE_MESSAGE =
  "No pudimos procesar tu solicitud en este momento. Inténtalo de nuevo en unos minutos.";

/** Mensaje para la persona; null si puede seguir. Es el mismo exista o no la cuenta del correo. */
export function rateLimitMessage(decision: RateDecision): string | null {
  if (decision === "limited") return RATE_LIMITED_MESSAGE;
  if (decision === "unavailable") return RATE_UNAVAILABLE_MESSAGE;
  return null;
}
