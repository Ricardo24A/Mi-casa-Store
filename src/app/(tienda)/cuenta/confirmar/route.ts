import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { setRecoveryCookie } from "@/lib/recovery-cookie";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

const typeSchema = z.enum(["signup", "email", "recovery"]);

/**
 * Destino de los enlaces de los correos de Supabase (confirmar correo y recuperar contraseña).
 * Admite los dos formatos: `token_hash` + `type` (plantilla recomendada, funciona aunque se abra
 * en otro navegador) y `code` (flujo PKCE por defecto).
 *
 * Recuperación de contraseña: lleva a /nueva-clave (también al administrador) y marca la sesión con
 * un aviso firmado de corta duración, que es lo único que permite cambiarla sin la contraseña actual.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = typeSchema.safeParse(searchParams.get("type") ?? searchParams.get("tipo"));
  const isRecovery = type.success && type.data === "recovery";
  const next = isRecovery ? "/nueva-clave" : safeNext(searchParams.get("next"), "/cuenta");

  const failure = NextResponse.redirect(new URL("/login?error=enlace", origin));
  const supabase = await createClient();

  let userId: string | undefined;
  if (tokenHash && type.success) {
    const { data, error } = await supabase.auth.verifyOtp({ type: type.data as EmailOtpType, token_hash: tokenHash });
    if (error) return failure;
    userId = data.user?.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure;
    userId = data.user?.id;
  } else {
    return failure;
  }

  const response = NextResponse.redirect(new URL(next, origin));
  if (isRecovery && userId) setRecoveryCookie(response, userId);
  return response;
}
