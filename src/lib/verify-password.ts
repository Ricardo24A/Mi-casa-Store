import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Reautenticación: comprueba la contraseña actual con un cliente aparte, sin cookies ni sesión
 * guardada, así no toca la sesión del navegador (ni baja el nivel 2FA de un administrador). La sesión
 * temporal que abre se cierra enseguida.
 */
export async function isCurrentPassword(email: string, password: string): Promise<boolean> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getSupabaseEnv();
  const temp = createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await temp.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await temp.auth.signOut({ scope: "local" });
  return true;
}
