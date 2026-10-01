import { cacheLife, cacheTag } from "next/cache";
import { isNormalizedEcPhone } from "@/lib/phone-ec";
import { createPublicClient } from "@/lib/supabase/public";

export const STORE_INFO_TAG = "tienda";

export interface StoreInfo {
  nombre: string;
  email: string | null;
  /** Solo dígitos, formato nacional y ya validado (ver `phone-ec.ts`). */
  telefono: string | null;
  telefonoSecundario: string | null;
  direccion: string | null;
  /** Texto libre del dueño; null = no se muestra. */
  horario: string | null;
  facebook: string | null;
}

/** Nombre que se usa mientras no se pueda leer la configuración. */
const DEFAULT_NAME = "Mi casa Store";

/**
 * Nombre, contacto, horario y redes (pie de página y /contacto). Lee la vista pública `store_public_info`, que solo trae
 * esas columnas (no cuentas bancarias, envío ni descuentos). Se cachea y se renueva cuando el
 * dueño guarda Configuración (etiqueta `tienda`). Si falla la lectura, la tienda sigue funcionando
 * con el nombre por defecto y sin datos de contacto.
 */
export async function getPublicStoreInfo(): Promise<StoreInfo> {
  "use cache";
  cacheLife("minutes");
  cacheTag(STORE_INFO_TAG);

  const empty: StoreInfo = { nombre: DEFAULT_NAME, email: null, telefono: null, telefonoSecundario: null, direccion: null, horario: null, facebook: null };
  const { data, error } = await createPublicClient()
    .from("store_public_info")
    .select("nombre_negocio, email_contacto, telefono, telefono_secundario, direccion, horario_atencion, enlaces_redes")
    .maybeSingle();
  if (error || !data) return empty;

  const redes = (data.enlaces_redes ?? {}) as Record<string, unknown>;
  const facebook = typeof redes.facebook === "string" && redes.facebook.startsWith("https://") ? redes.facebook : null;
  return {
    nombre: data.nombre_negocio || DEFAULT_NAME,
    email: data.email_contacto || null,
    // Defensivo: solo se publican números con el formato esperado
    telefono: data.telefono && isNormalizedEcPhone(data.telefono) ? data.telefono : null,
    telefonoSecundario: data.telefono_secundario && isNormalizedEcPhone(data.telefono_secundario) ? data.telefono_secundario : null,
    direccion: data.direccion || null,
    horario: data.horario_atencion || null,
    facebook,
  };
}
