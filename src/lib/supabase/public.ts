import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Cliente anónimo SIN cookies ni sesión, para el catálogo público. Es el único que se puede
 * usar dentro de funciones con `'use cache'` (no pueden leer cookies). Aplica RLS como `anon`:
 * solo ve productos activos, categorías y descuentos automáticos vigentes.
 */
export function createPublicClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getSupabaseEnv();
  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** URL pública de un archivo del bucket `product-images`. */
export function publicImageUrl(path: string): string {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabaseEnv();
  const clean = path.replace(/^\/+/, "");
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${clean
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
