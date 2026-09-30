"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/catalog";
import { STORE_INFO_TAG } from "@/lib/store-info";
import { createClient } from "@/lib/supabase/server";
import { readBankRows, settingsFieldErrors, settingsFormSchema } from "@/lib/validation/admin-settings";

export interface SettingsFormState {
  error?: string;
  saved?: boolean;
  fieldErrors?: Record<string, string>;
}

const GENERIC_ERROR = "No pudimos guardar la configuración. Inténtalo de nuevo.";
const FIELDS = [
  "nombre_negocio",
  "email_contacto",
  "telefono",
  "telefono_secundario",
  "direccion",
  "facebook",
  "horas_limite_pago",
  "descuento_transferencia_pct",
  "costo_envio",
  "envio_gratis_desde",
  "umbral_stock_bajo",
] as const;

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** La base de datos vuelve a validar (límites y formato de cuentas y redes): aquí se traduce su error. */
function dbError(error: { message: string }): SettingsFormState {
  const m = error.message;
  if (m.includes("store_settings_horas_limite_pago_check")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { horas_limite_pago: "El plazo debe ir de 1 a 168 horas." } };
  }
  if (m.includes("store_settings_descuento_transferencia_check")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { descuento_transferencia_pct: "Debe ser menor que 100." } };
  }
  if (m.includes("store_settings_telefono_secundario_valido") || m.includes("store_settings_telefonos_distintos")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { telefono_secundario: "Revisa el teléfono secundario." } };
  }
  if (m.includes("store_settings_telefono_valido")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { telefono: "Revisa el teléfono principal." } };
  }
  if (m.includes("store_settings_cuentas_validas")) return { error: "Revisa los datos de las cuentas bancarias." };
  if (m.includes("store_settings_redes_validas")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { facebook: "El enlace de Facebook no es válido." } };
  }
  return { error: GENERIC_ERROR };
}

/**
 * Guarda la configuración. Solo reglas (plazo, envío, descuento por transferencia, cuentas, contacto):
 * ningún precio ni total viene del navegador; el servidor calcula cada pedido con estos valores al
 * crearlo. Las cuentas bancarias y las reglas de cobro no son públicas: la tienda solo publica
 * nombre, contacto y redes (etiqueta `tienda`).
 */
export async function guardarConfiguracion(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdmin();

  const raw: Record<string, unknown> = Object.fromEntries(FIELDS.map((f) => [f, str(formData, f)]));
  raw.cuentas = readBankRows((name) => str(formData, name));
  const parsed = settingsFormSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revisa los datos marcados.", fieldErrors: settingsFieldErrors(parsed.error) };

  const supabase = await createClient();
  // Se exige recibir la fila actualizada: si RLS o los permisos la frenaran, no se diría "guardado".
  const { data, error } = await supabase.from("store_settings").update(parsed.data).eq("id", true).select("id");
  if (error) return dbError(error);
  if (!data || data.length !== 1) return { error: GENERIC_ERROR };

  // El envío y el descuento por transferencia cambian los totales: se invalida también el catálogo.
  updateTag(STORE_INFO_TAG);
  updateTag(CATALOG_TAG);
  revalidatePath("/admin", "layout");
  return { saved: true };
}
