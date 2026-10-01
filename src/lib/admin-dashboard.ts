import { createClient } from "@/lib/supabase/server";
import {
  stockAlertsSchema,
  summarySchema,
  type DashboardSummary,
  type StockAlerts,
} from "@/lib/validation/admin-dashboard";
import type { OrderStatus } from "@/types/database";

export interface OrderRow {
  referencia: string;
  estado: OrderStatus;
  total: number;
  created_at: string;
  vence_en: string;
  contacto_nombre: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  stock: StockAlerts;
  /** Comprobantes por revisar, el más antiguo primero. */
  toReview: OrderRow[];
  /** Pendientes de pago, el que vence primero arriba. */
  expiring: OrderRow[];
  latest: OrderRow[];
}

const ORDER_COLUMNS = "referencia, estado, total, created_at, vence_en, contacto_nombre";

/**
 * Datos del Resumen. SOLO tras `requireAdmin()`: las funciones `admin_*` comprueban por su cuenta
 * que la sesión sea de un administrador con 2FA, y las lecturas de `orders` pasan por RLS.
 * Null si algo falla (la página muestra un error, no ceros inventados).
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();
  const [summary, stock, toReview, expiring, latest] = await Promise.all([
    supabase.rpc("admin_dashboard_summary"),
    supabase.rpc("admin_stock_alerts", { p_limit: 8 }),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("estado", "comprobante_recibido")
      .order("updated_at", { ascending: true })
      .limit(10)
      .returns<OrderRow[]>(),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("estado", "pendiente_pago")
      .order("vence_en", { ascending: true })
      .limit(5)
      .returns<OrderRow[]>(),
    supabase.from("orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(8).returns<OrderRow[]>(),
  ]);

  const parsedSummary = summarySchema.safeParse(summary.data);
  const parsedStock = stockAlertsSchema.safeParse(stock.data);
  if (summary.error || stock.error || toReview.error || expiring.error || latest.error) return null;
  if (!parsedSummary.success || !parsedStock.success) return null;

  return {
    summary: parsedSummary.data,
    stock: parsedStock.data,
    toReview: (toReview.data ?? []).map((o) => ({ ...o, total: Number(o.total) })),
    expiring: (expiring.data ?? []).map((o) => ({ ...o, total: Number(o.total) })),
    latest: (latest.data ?? []).map((o) => ({ ...o, total: Number(o.total) })),
  };
}
