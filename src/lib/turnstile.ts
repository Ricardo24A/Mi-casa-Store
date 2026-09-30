import "server-only";
import { headers } from "next/headers";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifica el token de Cloudflare Turnstile en el servidor.
 * - Con TURNSTILE_SECRET_KEY: el token se valida siempre.
 * - Sin clave en producción: se rechaza (falla cerrado), para no dejar registro y login sin CAPTCHA.
 * - Sin clave en desarrollo: se omite, para poder trabajar sin cuenta de Cloudflare.
 *   (Para probar con clave: secreto de prueba 1x0000000000000000000000000000000AA.)
 */
export async function verifyTurnstile(token: unknown): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
