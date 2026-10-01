"use server";

import { redirect } from "next/navigation";
import { ADMIN_HOME, ADMIN_LOGIN } from "@/lib/admin-access";
import { getAdminSession, guardAdminArea } from "@/lib/auth";
import { checkRateLimits } from "@/lib/rate-limit";
import { rateLimitMessage } from "@/lib/rate-limit-core";
import { createClient } from "@/lib/supabase/server";
import { totpVerifySchema } from "@/lib/validation/admin-auth";

export interface FormState {
  error?: string;
}

const CODE_ERROR = "Código incorrecto o vencido. Revisa la hora de tu teléfono e inténtalo de nuevo.";
const SESSION_ERROR = "Tu sesión expiró. Inicia sesión de nuevo.";

// El inicio de sesión del administrador es el login único (/login): ver src/app/(acceso)/actions.ts.
// Aquí solo viven los pasos posteriores: enrolar, verificar el código y salir.

export type EnrollStart =
  | { ok: true; factorId: string; qr: string; secret: string }
  | { ok: false; error: string };

/**
 * Crea un factor TOTP nuevo (sin verificar) y devuelve el QR y la clave manual.
 * Permitido a un admin sin factor (primer acceso) o a uno con aal2 (dispositivo adicional).
 */
export async function empezarEnrolamiento(): Promise<EnrollStart> {
  const session = await getAdminSession();
  if (!session.userId || session.role !== "admin") return { ok: false, error: SESSION_ERROR };
  if (session.hasVerifiedFactor && session.aal !== "aal2") {
    return { ok: false, error: "Primero verifica tu código." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const factors = user?.factors ?? [];

  // Un intento anterior abandonado deja un factor sin verificar: se descarta.
  for (const factor of factors.filter((f) => f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const verified = factors.filter((f) => f.status === "verified").length;

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Mi casa Store",
    friendlyName: `Dispositivo ${verified + 1}`,
  });
  if (error || !data) return { ok: false, error: "No pudimos preparar el código. Inténtalo de nuevo." };

  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export type ConfirmResult = { ok: true } | { ok: false; error: string };

/** Confirma el factor recién creado con el primer código de la app. Sube la sesión a aal2. */
export async function confirmarEnrolamiento(input: { factorId: string; code: string }): Promise<ConfirmResult> {
  const session = await getAdminSession();
  if (!session.userId || session.role !== "admin") return { ok: false, error: SESSION_ERROR };
  if (session.hasVerifiedFactor && session.aal !== "aal2") {
    return { ok: false, error: "Primero verifica tu código." };
  }

  const parsed = totpVerifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe los 6 dígitos que muestra la app." };
  // Mismo contador que verificarCodigo (por usuario, falla abierto).
  const limited = rateLimitMessage(await checkRateLimits([{ rule: "codigo2fa", identity: session.userId }], "open"));
  if (limited) return { ok: false, error: limited };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) return { ok: false, error: CODE_ERROR };
  return { ok: true };
}

/** Pide el código de un factor ya verificado. Con éxito la sesión pasa a aal2. */
export async function verificarCodigo(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await guardAdminArea("verificar");

  const parsed = totpVerifySchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: "Escribe los 6 dígitos que muestra la app." };
  // Por usuario. Falla abierto: Supabase Auth también limita la verificación, y bloquear aquí dejaría
  // al dueño fuera del panel si la función de límite fallara.
  const limited = rateLimitMessage(await checkRateLimits([{ rule: "codigo2fa", identity: session.userId }], "open"));
  if (limited) return { error: limited };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) return { error: CODE_ERROR };

  redirect(ADMIN_HOME);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ADMIN_LOGIN);
}
