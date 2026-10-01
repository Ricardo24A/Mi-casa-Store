import "server-only";
import { getAdminSession } from "@/lib/auth";
import { hasRecoveryCookie } from "@/lib/recovery-cookie";
import type { PasswordChangeRules } from "@/lib/validation/password";

/**
 * Qué debe pedir el cambio de contraseña a la sesión actual (lo usan /nueva-clave y su acción):
 *  - la contraseña actual, salvo que la sesión venga del enlace de recuperación del correo;
 *  - el código de 2 pasos, si es un administrador con 2FA que aún no lo validó en esta sesión
 *    (el enlace de recuperación abre una sesión de solo contraseña).
 */
export async function passwordChangeRules(userId: string): Promise<PasswordChangeRules> {
  const [session, recovery] = await Promise.all([getAdminSession(), hasRecoveryCookie(userId)]);
  return {
    needsCurrent: !recovery,
    needsCode: session.role === "admin" && session.hasVerifiedFactor && session.aal !== "aal2",
  };
}
