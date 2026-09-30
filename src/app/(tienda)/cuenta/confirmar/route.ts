import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

const typeSchema = z.enum(["signup", "email", "recovery"]);

/**
 * Destino de los enlaces de los correos de Supabase (confirmar correo y recuperar contraseña).
 * Admite los dos formatos: `token_hash` + `type` (plantilla recomendada, funciona aunque se abra
 * en otro navegador) y `code` (flujo PKCE por defecto).
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

  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({ type: type.data as EmailOtpType, token_hash: tokenHash });
    return error ? failure : NextResponse.redirect(new URL(next, origin));
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? failure : NextResponse.redirect(new URL(next, origin));
  }
  return failure;
}
