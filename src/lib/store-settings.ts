import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TotalsSettings } from "@/lib/order-totals";

export interface BankAccount {
  banco: string;
  tipo: "ahorros" | "corriente";
  numero: string;
  titular: string;
  identificacion: string;
}

export interface CheckoutSettings extends TotalsSettings {
  horas_limite_pago: number;
  cuentas_bancarias: BankAccount[];
}

/**
 * Reglas de cobro y cuentas para pagar. Solo el servidor las lee (con la clave de servicio, porque
 * `store_settings` es solo del administrador); la tienda entrega al comprador únicamente lo que
 * necesita ver. Las usan el checkout, `crearPedido` y la pantalla de pago: así un cambio en
 * Configuración se nota en el siguiente pedido, sin constantes en el código.
 * Null si no hay configuración (no debería pasar: la fila la crea la migración).
 */
export async function getCheckoutSettings(): Promise<CheckoutSettings | null> {
  const { data } = await createAdminClient()
    .from("store_settings")
    .select("costo_envio, envio_gratis_desde, descuento_transferencia_pct, horas_limite_pago, cuentas_bancarias")
    .maybeSingle();
  if (!data) return null;
  return {
    costo_envio: data.costo_envio === null ? null : Number(data.costo_envio),
    envio_gratis_desde: data.envio_gratis_desde === null ? null : Number(data.envio_gratis_desde),
    descuento_transferencia_pct: Number(data.descuento_transferencia_pct),
    horas_limite_pago: Number(data.horas_limite_pago),
    cuentas_bancarias: (Array.isArray(data.cuentas_bancarias) ? data.cuentas_bancarias : []) as BankAccount[],
  };
}
