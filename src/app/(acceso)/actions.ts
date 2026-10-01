"use server";

import { redirect } from "next/navigation";
import { postLoginDestination } from "@/lib/admin-access";
import { requireCustomer } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { checkRateLimits } from "@/lib/rate-limit";
import { emailIdentity, rateLimitMessage } from "@/lib/rate-limit-core";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  fieldErrors,
  loginSchema,
  newPasswordSchema,
  recoverSchema,
  registerSchema,
} from "@/lib/validation/account";

export interface AccountFormState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
  /** Valores para no obligar a escribir todo de nuevo. Nunca contraseñas. */
  values?: Record<string, string>;
}

// Mensajes únicos: no revelan si un correo existe, si la cuenta es de un administrador ni
// por qué falló un acceso.
const LOGIN_ERROR = "Correo o contraseña incorrectos.";
const CAPTCHA_ERROR = "No pudimos verificar que eres una persona. Inténtalo de nuevo.";
const RATE_LIMIT_ERROR = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/**
 * Login único de clientes y administrador. Solo después de validar la contraseña se conoce el
 * rol: un cliente va al `next` (si pasa safeNext) o al home; un administrador va a /admin, donde
 * el proxy le pide registrar o verificar el 2FA. Con solo la contraseña (aal1) un administrador
 * nunca obtiene el panel. La respuesta de error es idéntica para cualquier fallo.
 */
export async function iniciarSesion(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const values = { email: str(formData, "email").slice(0, 254) };
  const parsed = loginSchema.safeParse({ email: values.email, password: str(formData, "password") });
  if (!parsed.success) return { error: LOGIN_ERROR, values };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) return { error: CAPTCHA_ERROR, values };
  // Por IP y por correo, exista o no la cuenta (el mensaje no lo revela). Falla cerrado: sin límite
  // se podrían probar contraseñas sin freno.
  const limited = rateLimitMessage(
    await checkRateLimits(
      [
        { rule: "loginIp", identity: await clientIp() },
        { rule: "loginEmail", identity: emailIdentity(parsed.data.email) },
      ],
      "closed",
    ),
  );
  if (limited) return { error: limited, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.status === 429) return { error: RATE_LIMIT_ERROR, values };
  if (error?.code === "email_not_confirmed") {
    return { error: "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.", values };
  }
  if (error || !data.user) return { error: LOGIN_ERROR, values };

  // Un administrador con solo la contraseña puede leer su propia fila (RLS: id = auth.uid()).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const destination = postLoginDestination(profile?.role, formData.get("next"));
  if (!destination) {
    // Cuenta sin perfil o con un rol desconocido: no se deja sesión abierta.
    await supabase.auth.signOut();
    return { error: LOGIN_ERROR, values };
  }
  redirect(destination);
}

export async function registrar(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const values = { nombre: str(formData, "nombre").slice(0, 120), email: str(formData, "email").slice(0, 254) };
  const parsed = registerSchema.safeParse({
    nombre: values.nombre,
    email: values.email,
    password: str(formData, "password"),
    confirm: str(formData, "confirm"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) return { error: CAPTCHA_ERROR, values };
  // Falla cerrado: sin límite se podrían crear cuentas falsas en masa.
  const limited = rateLimitMessage(
    await checkRateLimits(
      [
        { rule: "registroIp", identity: await clientIp() },
        { rule: "registroEmail", identity: emailIdentity(parsed.data.email) },
      ],
      "closed",
    ),
  );
  if (limited) return { error: limited, values };

  const next = safeNext(formData.get("next"), "");
  const redirectTo = `${siteUrl()}/cuenta/confirmar${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const supabase = await createClient();
  // El rol NO se envía: el trigger de la base de datos crea el perfil siempre como 'customer'.
  // Solo viaja el nombre.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: redirectTo, data: { full_name: parsed.data.nombre } },
  });
  if (error?.status === 429) return { error: RATE_LIMIT_ERROR, values };
  if (error) {
    return { error: "No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo.", values };
  }

  // Si el proyecto no exige confirmar el correo, ya hay sesión.
  if (data.session) redirect(safeNext(next, "/"));

  // Misma respuesta exista o no el correo (Supabase no distingue), para no revelar cuentas.
  return {
    ok: "Te enviamos un correo para confirmar tu cuenta. Revisa también la carpeta de spam.",
  };
}

export async function solicitarRecuperacion(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const values = { email: str(formData, "email").slice(0, 254) };
  const parsed = recoverSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) return { error: CAPTCHA_ERROR, values };
  // Falla abierto: Supabase Auth también limita los correos de recuperación, y bloquear aquí dejaría a
  // alguien sin poder recuperar su cuenta. El mensaje es el mismo exista o no el correo.
  const limited = rateLimitMessage(
    await checkRateLimits(
      [
        { rule: "recuperarIp", identity: await clientIp() },
        { rule: "recuperarEmail", identity: emailIdentity(parsed.data.email) },
      ],
      "open",
    ),
  );
  if (limited) return { error: limited, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/cuenta/confirmar?tipo=recovery`,
  });
  if (error?.status === 429) return { error: RATE_LIMIT_ERROR, values };

  // Siempre la misma respuesta: no se revela si el correo tiene cuenta.
  return { ok: "Si el correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva." };
}

/** Cambia la contraseña con la sesión que abrió el enlace de recuperación. */
export async function guardarNuevaClave(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  await requireCustomer();
  const parsed = newPasswordSchema.safeParse({
    password: str(formData, "password"),
    confirm: str(formData, "confirm"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "No pudimos cambiar la contraseña. Pide un enlace nuevo e inténtalo otra vez." };
  }
  return { ok: "Tu contraseña se cambió correctamente." };
}
