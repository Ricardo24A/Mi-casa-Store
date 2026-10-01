import { z } from "zod";

/** Lo que devuelven `admin_dashboard_summary` y `admin_stock_alerts`, validado antes de mostrarlo. */
const sales = z.object({ pedidos: z.number().int().min(0), total: z.number().min(0) });

export const summarySchema = z.object({
  estados: z.record(z.string(), z.number().int().min(0)),
  hoy: sales,
  mes: sales,
});
export type DashboardSummary = z.infer<typeof summarySchema>;

const stockItem = z.object({
  id: z.uuid(),
  nombre: z.string(),
  stock: z.number().int(),
  stock_reservado: z.number().int(),
});
const stockGroup = z.object({ total: z.number().int().min(0), items: z.array(stockItem) });

export const stockAlertsSchema = z.object({
  umbral: z.number().int().min(0),
  agotados: stockGroup,
  poco: stockGroup,
});
export type StockAlerts = z.infer<typeof stockAlertsSchema>;

/** Ticket promedio en dólares con 2 decimales; null si no hay pedidos (no se inventa un promedio). */
export function averageTicket(total: number, orders: number): number | null {
  if (orders <= 0) return null;
  return Math.round((total * 100) / orders) / 100;
}

/** Cantidad de pedidos en un estado (0 si no hay ninguno). */
export function countIn(estados: Record<string, number>, estado: string): number {
  return estados[estado] ?? 0;
}
