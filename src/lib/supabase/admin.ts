import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { getServiceRoleKey } from "@/lib/server-env";

/**
 * Cliente con la clave service_role: SE SALTA RLS. Úsalo solo en servidor y solo para lo que
 * el cliente no puede hacer por sí mismo: crear pedidos y comprobantes, validar cupones,
 * leer las cuentas bancarias para la pantalla de pago y firmar URLs de comprobantes.
 * Antes de usarlo, valida la entrada con Zod y comprueba quién es el usuario.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabaseEnv();
  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
