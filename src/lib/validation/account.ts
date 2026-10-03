import { z } from "zod";
import { PROVINCIAS } from "@/config/ecuador";
import { text, uuid } from "./common";
import { passwordSchema } from "./password";
import { acceptTermsField } from "./terms";

export { passwordSchema };

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: "Escribe un correo válido" }).max(254, { error: "El correo es demasiado largo" }));

/** Teléfono: dígitos, espacios, +, paréntesis y guion (mismo patrón que la base de datos). */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+ ()-]{7,20}$/, "Escribe un teléfono válido");

export const registerSchema = z
  .object({
    nombre: text(2, 120),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    // Casilla obligatoria: se valida aquí, en el servidor, no solo en el navegador.
    acepta: acceptTermsField,
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const recoverSchema = z.object({ email: emailSchema });

export const profileSchema = z.object({
  full_name: text(2, 120),
  // Vacío = sin teléfono
  phone: z.union([phoneSchema, z.literal("").transform(() => null)]),
});

export const addressSchema = z.object({
  etiqueta: text(1, 40),
  destinatario: text(1, 120),
  telefono: phoneSchema,
  provincia: z.enum(PROVINCIAS, { error: "Elige una provincia" }),
  ciudad: text(1, 80),
  direccion: text(5, 200),
  referencia: z.union([text(1, 200), z.literal("").transform(() => null)]),
  es_predeterminada: z.boolean(),
});

export const addressIdSchema = z.object({ id: uuid });

export type AddressInput = z.infer<typeof addressSchema>;

/** Convierte los errores de Zod en { campo: mensaje } para mostrarlos junto a cada campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
