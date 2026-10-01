import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { RECOVERY_TTL_SECONDS, signRecovery, verifyRecovery } from "@/lib/recovery-token";
import { getHmacSecret } from "@/lib/server-env";

const COOKIE = "mc_recuperacion";

/** Tras validar el enlace de recuperación del correo: marca la sesión (cookie httpOnly, 15 minutos). */
export function setRecoveryCookie(response: NextResponse, userId: string) {
  response.cookies.set(COOKIE, signRecovery(userId, getHmacSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RECOVERY_TTL_SECONDS,
  });
}

/** ¿Esta sesión viene del enlace de recuperación de este usuario y aún no vence? */
export async function hasRecoveryCookie(userId: string): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  return verifyRecovery(value, userId, getHmacSecret());
}

export async function clearRecoveryCookie() {
  (await cookies()).delete(COOKIE);
}
