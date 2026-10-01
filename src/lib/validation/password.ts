import { z } from "zod";
import "./common.ts"; // mensajes de Zod en español

/** 10 a 72 caracteres (72 es el máximo que admite bcrypt, que usa Supabase Auth). */
export const passwordSchema = z
  .string()
  .min(10, "Usa al menos 10 caracteres")
  .max(72, "Usa como máximo 72 caracteres");

export interface PasswordChangeRules {
  /**
   * Pedir la contraseña actual. Siempre, salvo cuando se llega desde el enlace de recuperación del
   * correo (ahí la persona la olvidó; el enlace ya prueba que controla el correo).
   */
  needsCurrent: boolean;
  /** Pedir el código de 2 pasos: un administrador con 2FA que aún no lo validó en esta sesión. */
  needsCode: boolean;
}

/**
 * Cambio de contraseña. Los campos que no aplican se ignoran (no se exigen ni se validan). El
 * `factorId` lo pone el servidor en el formulario y se vuelve a comprobar contra los factores del usuario.
 */
export function passwordChangeSchema({ needsCurrent, needsCode }: PasswordChangeRules) {
  return z
    .object({
      password: passwordSchema,
      confirm: z.string(),
      current: needsCurrent ? z.string().min(1, "Escribe tu contraseña actual").max(200) : z.unknown().transform(() => null),
      code: needsCode
        ? z.string().trim().regex(/^\d{6}$/, "Escribe los 6 dígitos que muestra la app")
        : z.unknown().transform(() => null),
    })
    .superRefine((v, ctx) => {
      if (v.password !== v.confirm) {
        ctx.addIssue({ code: "custom", path: ["confirm"], message: "Las contraseñas no coinciden" });
      }
      if (typeof v.current === "string" && v.current === v.password) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "La contraseña nueva debe ser distinta de la actual" });
      }
    });
}
