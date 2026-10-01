import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getServiceRoleKey } from "@/lib/env";

/**
 * Huella del IP del visitante para los límites de envíos: HMAC-SHA256 con una clave que solo tiene
 * el servidor, así la base nunca guarda el IP y la huella no se puede revertir probando los 4.300
 * millones de IPv4. La clave es `RATE_LIMIT_SECRET` o, si no está, la clave de servicio de Supabase
 * (ya es secreta y solo vive en el servidor). Cambiar la clave solo reinicia los contadores.
 *
 * En Vercel, `x-real-ip` y el primer valor de `x-forwarded-for` los pone la plataforma. Sin IP
 * (desarrollo local) devuelve null y solo se aplica el límite por correo.
 */
export async function clientIpHash(scope: string): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  if (!ip || ip.length > 64) return null;
  const key = process.env.RATE_LIMIT_SECRET || getServiceRoleKey();
  return createHmac("sha256", key).update(`${scope}:${ip}`).digest("hex");
}
