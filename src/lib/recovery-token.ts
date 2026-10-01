import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Aviso firmado de "esta sesión viene del enlace de recuperación del correo". Lo pone
 * `/cuenta/confirmar` en una cookie httpOnly y lo lee `/nueva-clave`: solo con él se cambia la
 * contraseña sin escribir la actual. Va atado al usuario y vence pronto.
 * Formato: `<userId>.<vence en ms>.<firma>`. La clave la pasa el servidor (`recovery-cookie.ts`).
 */

export const RECOVERY_TTL_SECONDS = 15 * 60;

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`recuperacion:${payload}`).digest("base64url");
}

export function signRecovery(userId: string, secret: string, now = Date.now()): string {
  const payload = `${userId}.${now + RECOVERY_TTL_SECONDS * 1000}`;
  return `${payload}.${signature(payload, secret)}`;
}

/** ¿El aviso es válido, de este usuario y no venció? */
export function verifyRecovery(token: string | undefined, userId: string, secret: string, now = Date.now()): boolean {
  if (!token || token.length > 300) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenUser, expires, sig] = parts;
  if (tokenUser !== userId || !/^\d{1,15}$/.test(expires) || Number(expires) <= now) return false;
  const expected = Buffer.from(signature(`${tokenUser}.${expires}`, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
