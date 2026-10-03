import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Cliente de Supabase para componentes de servidor, acciones y route handlers.
 * Usa la sesión del usuario en cookies, así que aplica las políticas RLS.
 */
export async function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Las cookies de sesión solo viajan por HTTPS en producción (en desarrollo local se sirve por http).
      // La biblioteca no marca `Secure` por su cuenta. No puede ser httpOnly: el navegador debe leer la sesión.
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component: se ignora; el refresco de sesión
            // lo hará el proxy (Fase 1).
          }
        },
      },
    },
  );
}
