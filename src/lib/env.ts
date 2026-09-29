import { z } from "zod";

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Clave "anon" o "publishable" del proyecto. Es pública; la seguridad la dan las políticas RLS.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Lee y valida las variables de Supabase en el momento de usarlas
 * (no al importar), para que `next build` no falle si aún no están definidas.
 */
export function getSupabaseEnv() {
  const parsed = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Faltan o son inválidas las variables de Supabase. Revisa .env.local (ver .env.example).",
    );
  }
  return parsed.data;
}

/**
 * Clave service_role. Solo servidor: no importar este módulo desde componentes de cliente
 * (la variable no tiene NEXT_PUBLIC_, así que en el navegador llegaría vacía).
 */
export function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Revisa .env.local (ver .env.example).",
    );
  }
  return key;
}
