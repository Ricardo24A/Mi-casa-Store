import "server-only";
import { createHmac } from "node:crypto";
import { getHmacSecret } from "@/lib/server-env";

/**
 * Huella HMAC-SHA256 (hex, 64 caracteres) de un dato personal (IP, correo, id de usuario) dentro de un
 * ámbito. La base de datos solo guarda esto: no se puede revertir sin la clave del servidor.
 */
export function hmacHex(scope: string, value: string): string {
  return createHmac("sha256", getHmacSecret()).update(`${scope}:${value}`).digest("hex");
}
