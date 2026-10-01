import { z } from "zod";
import { normalizeEcPhone } from "../phone-ec.ts";
import "./common.ts"; // mensajes de Zod en español

/**
 * Formulario de /contacto. Las mismas reglas están en la base de datos (`create_contact_message` y las
 * restricciones de `contact_messages`, migración 20): si se cambia una, cambiar la otra.
 * Los largos se cuentan en caracteres (como `char_length` de Postgres), no en unidades UTF-16.
 */

export const CONTACT_LIMITS = {
  nombre: { min: 2, max: 120 },
  asunto: { max: 120 },
  mensaje: { min: 10, max: 1000 },
} as const;

/** Cualquier cosa con forma de etiqueta HTML: `<` seguido de letra, `/` o `!`. "a < b" y "<3" pasan. */
const HTML_TAG = /<\/?[A-Za-z!]/;
const HTML_ERROR = "Escribe solo texto, sin etiquetas HTML";
const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000b-\u001f\u007f]/;

/** Mismo patrón que `valid_contact_email` en la base (Zod acepta algunos correos que la base no). */
const EMAIL_DB = /^[A-Za-z0-9._'+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}$/;

export const charCount = (s: string) => Array.from(s).length;

function line(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      const n = charCount(v);
      if (n === 0 && min > 0) ctx.addIssue({ code: "custom", message: `Escribe tu ${label}` });
      else if (n < min) ctx.addIssue({ code: "custom", message: `Usa al menos ${min} caracteres` });
      else if (n > max) ctx.addIssue({ code: "custom", message: `Usa como máximo ${max} caracteres` });
      else if (CONTROL.test(v)) ctx.addIssue({ code: "custom", message: "Hay caracteres no permitidos" });
      else if (HTML_TAG.test(v)) ctx.addIssue({ code: "custom", message: HTML_ERROR });
    });
}

const email = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    if (v === "") ctx.addIssue({ code: "custom", message: "Escribe tu correo" });
    else if (v.length > 254 || !z.email().safeParse(v).success || !EMAIL_DB.test(v) || v.includes("..")) {
      ctx.addIssue({ code: "custom", message: "Escribe un correo válido, por ejemplo nombre@correo.com" });
    }
  });

/** Teléfono obligatorio: misma normalización y regla de Ecuador que los teléfonos del negocio. */
const phone = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    if (raw === "") {
      ctx.addIssue({ code: "custom", message: "Escribe tu teléfono para poder contactarte" });
      return z.NEVER;
    }
    const r = normalizeEcPhone(raw);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.digits;
  });

/** Mensaje de varias líneas: saltos de línea de Windows normalizados, largo en caracteres. */
const message = z
  .string()
  .transform((v) => v.replace(/\r\n?/g, "\n").trim())
  .superRefine((v, ctx) => {
    const n = charCount(v);
    const { min, max } = CONTACT_LIMITS.mensaje;
    if (n === 0) ctx.addIssue({ code: "custom", message: "Escribe tu mensaje" });
    else if (n < min) ctx.addIssue({ code: "custom", message: `Cuéntanos un poco más: al menos ${min} caracteres` });
    else if (n > max) ctx.addIssue({ code: "custom", message: `Usa como máximo ${max} caracteres (llevas ${n})` });
    else if (CONTROL_EXCEPT_NEWLINE_TAB.test(v)) ctx.addIssue({ code: "custom", message: "Hay caracteres no permitidos" });
    else if (HTML_TAG.test(v)) ctx.addIssue({ code: "custom", message: HTML_ERROR });
  });

export const contactFormSchema = z.object({
  nombre: line("nombre", CONTACT_LIMITS.nombre.min, CONTACT_LIMITS.nombre.max),
  email,
  telefono: phone,
  // Opcional: vacío = sin asunto
  asunto: line("asunto", 0, CONTACT_LIMITS.asunto.max).transform((v) => (v === "" ? null : v)),
  mensaje: message,
  acepta: z.literal("on", { error: "Para enviar el mensaje, acepta el uso de tus datos" }),
});

export type ContactInput = z.infer<typeof contactFormSchema>;

/** Orden de los campos en la pantalla: para llevar el foco al primer error. */
export const CONTACT_FIELDS = ["nombre", "email", "telefono", "asunto", "mensaje", "acepta"] as const;

/** Horario de atención de Configuración: opcional, una línea de hasta 120 caracteres. */
export const businessHoursSchema = line("horario", 0, 120).transform((v) => (v === "" ? null : v));
