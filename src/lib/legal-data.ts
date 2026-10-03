import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { STORE_INFO_TAG } from "@/lib/store-info";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Plazo de pago real (horas_limite_pago de Configuración) para mostrarlo en los Términos y Condiciones.
 * Es un dato público (el cliente lo ve al pagar), pero `store_settings` solo lo lee el servidor, así que
 * se lee aquí con la clave de servicio y SOLO esa columna. Se cachea con la etiqueta `tienda`: al guardar
 * Configuración (updateTag) el texto se actualiza. Null si no se pudo leer: la página no inventa un número.
 */
export async function getPaymentDeadlineHours(): Promise<number | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(STORE_INFO_TAG);

  const { data, error } = await createAdminClient().from("store_settings").select("horas_limite_pago").maybeSingle();
  if (error || !data) return null;
  const hours = Number(data.horas_limite_pago);
  return Number.isInteger(hours) && hours >= 1 && hours <= 168 ? hours : null;
}
