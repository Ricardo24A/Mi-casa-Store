import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export const STORE_INFO_TAG = "tienda";

export interface StoreInfo {
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  facebook: string | null;
}

/** Nombre que se usa mientras no se pueda leer la configuración. */
const DEFAULT_NAME = "Mi casa Store";

/**
 * Nombre, contacto y redes del pie de página. Lee la vista pública `store_public_info`, que solo trae
 * esas columnas (no cuentas bancarias, envío ni descuentos). Se cachea y se renueva cuando el
 * dueño guarda Configuración (etiqueta `tienda`). Si falla la lectura, la tienda sigue funcionando
 * con el nombre por defecto y sin datos de contacto.
 */
export async function getPublicStoreInfo(): Promise<StoreInfo> {
  "use cache";
  cacheLife("minutes");
  cacheTag(STORE_INFO_TAG);

  const empty: StoreInfo = { nombre: DEFAULT_NAME, email: null, telefono: null, direccion: null, facebook: null };
  const { data, error } = await createPublicClient()
    .from("store_public_info")
    .select("nombre_negocio, email_contacto, telefono, direccion, enlaces_redes")
    .maybeSingle();
  if (error || !data) return empty;

  const redes = (data.enlaces_redes ?? {}) as Record<string, unknown>;
  const facebook = typeof redes.facebook === "string" && redes.facebook.startsWith("https://") ? redes.facebook : null;
  return {
    nombre: data.nombre_negocio || DEFAULT_NAME,
    email: data.email_contacto || null,
    telefono: data.telefono || null,
    direccion: data.direccion || null,
    facebook,
  };
}
