"use server";

import { clientIpHash } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { fieldErrors } from "@/lib/validation/account";
import { contactFormSchema } from "@/lib/validation/contact";

export interface ContactFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const GENERIC_ERROR = "No pudimos enviar tu mensaje. Inténtalo de nuevo en un momento.";
const CHECK_ERROR = "Revisa los datos marcados.";
const CAPTCHA_ERROR = "No pudimos verificar que eres una persona. Inténtalo de nuevo.";
const RATE_LIMIT_ERROR = "Recibimos varios mensajes tuyos hace poco. Espera un rato antes de enviar otro.";

/** Errores de `create_contact_message` (la base vuelve a validar todo): se muestran junto a cada campo. */
const DB_FIELD_ERRORS: Record<string, [string, string]> = {
  nombre_invalido: ["nombre", "Revisa tu nombre."],
  email_invalido: ["email", "Escribe un correo válido, por ejemplo nombre@correo.com"],
  telefono_invalido: ["telefono", "Revisa tu teléfono."],
  asunto_invalido: ["asunto", "Revisa el asunto."],
  mensaje_invalido: ["mensaje", "Revisa tu mensaje: entre 10 y 1000 caracteres, solo texto."],
  aceptacion_requerida: ["acepta", "Para enviar el mensaje, acepta el uso de tus datos"],
};

function str(formData: FormData, name: string, max: number) {
  const v = formData.get(name);
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * Mensaje de /contacto. No hace falta cuenta. Orden de las defensas:
 *  1. Campo trampa (`sitio_web`): una persona no lo ve ni lo llena; si llega con algo, se responde
 *     como si se hubiera enviado y no se guarda nada (el robot no aprende que lo detectamos).
 *  2. Zod en el servidor (lo que valida el navegador no cuenta).
 *  3. Turnstile, igual que el login.
 *  4. La base de datos valida otra vez y aplica el límite de envíos por correo y por IP.
 * El mensaje se guarda como texto plano y el panel lo muestra escapado (nunca como HTML).
 */
export async function enviarMensaje(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  if (str(formData, "sitio_web", 200).trim() !== "") return { ok: true };

  const parsed = contactFormSchema.safeParse({
    nombre: str(formData, "nombre", 500),
    email: str(formData, "email", 500),
    telefono: str(formData, "telefono", 50),
    asunto: str(formData, "asunto", 500),
    // Un poco más que el máximo, para poder decir cuántos caracteres lleva
    mensaje: str(formData, "mensaje", 5000),
    acepta: formData.get("acepta"),
  });
  if (!parsed.success) return { error: CHECK_ERROR, fieldErrors: fieldErrors(parsed.error) };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) return { error: CAPTCHA_ERROR };

  const m = parsed.data;
  const { error } = await createAdminClient().rpc("create_contact_message", {
    p_nombre: m.nombre,
    p_email: m.email,
    p_telefono: m.telefono,
    p_asunto: m.asunto,
    p_mensaje: m.mensaje,
    p_acepta: true,
    p_ip_hash: await clientIpHash("contacto"),
  });
  if (error) {
    if (error.message === "limite_mensajes") return { error: RATE_LIMIT_ERROR };
    const field = DB_FIELD_ERRORS[error.message];
    if (field) return { error: CHECK_ERROR, fieldErrors: { [field[0]]: field[1] } };
    return { error: GENERIC_ERROR };
  }
  return { ok: true };
}
