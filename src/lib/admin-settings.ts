import { createClient } from "@/lib/supabase/server";

export interface SettingsDefaults {
  nombre_negocio: string;
  email_contacto: string;
  telefono: string;
  direccion: string;
  facebook: string;
  horas_limite_pago: string;
  descuento_transferencia_pct: string;
  costo_envio: string;
  envio_gratis_desde: string;
  umbral_stock_bajo: string;
  cuentas: { banco: string; tipo: string; numero: string; titular: string; identificacion: string }[];
}

const show = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** Valores actuales para el formulario. Solo tras `requireAdmin()`: RLS deja leer `store_settings` al admin con 2FA. */
export async function getSettingsDefaults(): Promise<SettingsDefaults | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select(
      "nombre_negocio, email_contacto, telefono, direccion, cuentas_bancarias, costo_envio, envio_gratis_desde, descuento_transferencia_pct, horas_limite_pago, umbral_stock_bajo, enlaces_redes",
    )
    .maybeSingle();
  if (!data) return null;

  const redes = (data.enlaces_redes ?? {}) as Record<string, unknown>;
  const cuentas = Array.isArray(data.cuentas_bancarias) ? (data.cuentas_bancarias as Record<string, unknown>[]) : [];
  return {
    nombre_negocio: data.nombre_negocio ?? "",
    email_contacto: data.email_contacto ?? "",
    telefono: data.telefono ?? "",
    direccion: data.direccion ?? "",
    facebook: typeof redes.facebook === "string" ? redes.facebook : "",
    horas_limite_pago: show(data.horas_limite_pago),
    descuento_transferencia_pct: show(data.descuento_transferencia_pct),
    costo_envio: show(data.costo_envio === null ? null : Number(data.costo_envio)),
    envio_gratis_desde: show(data.envio_gratis_desde === null ? null : Number(data.envio_gratis_desde)),
    umbral_stock_bajo: show(data.umbral_stock_bajo),
    cuentas: cuentas.map((c) => ({
      banco: String(c.banco ?? ""),
      tipo: String(c.tipo ?? "ahorros"),
      numero: String(c.numero ?? ""),
      titular: String(c.titular ?? ""),
      identificacion: String(c.identificacion ?? ""),
    })),
  };
}
