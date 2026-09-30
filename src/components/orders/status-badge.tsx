import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

const TONE: Record<OrderStatus, string> = {
  pendiente_pago: "bg-soft text-ink",
  comprobante_recibido: "bg-sale-ink text-white",
  pagado: "bg-accent text-white",
  enviado: "bg-accent-mid text-accent-hover",
  entregado: "bg-accent-soft text-accent",
  rechazado: "bg-sale-soft text-sale-ink",
  cancelado: "bg-sale-soft text-sale-ink",
  vencido: "bg-bg-alt text-ink-soft",
};

/** Estado del pedido como etiqueta. El texto dice el estado (no solo el color). */
export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", TONE[status], className)}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
