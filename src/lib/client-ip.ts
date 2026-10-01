import "server-only";
import { headers } from "next/headers";
import { hmacHex } from "@/lib/hmac";

/**
 * IP del visitante. En Vercel, `x-real-ip` y el primer valor de `x-forwarded-for` los pone la
 * plataforma. Sin IP (desarrollo local) devuelve null y solo se aplican los límites por correo o usuario.
 * Nunca se guarda en claro: ver `clientIpHash` y `rate-limit.ts`.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  return ip && ip.length <= 64 ? ip : null;
}

/** Huella HMAC del IP para un ámbito (p. ej. "contacto"), o null si no hay IP. */
export async function clientIpHash(scope: string): Promise<string | null> {
  const ip = await clientIp();
  return ip ? hmacHex(scope, ip) : null;
}
