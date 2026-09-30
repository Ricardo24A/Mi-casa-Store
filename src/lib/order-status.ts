import type { OrderStatus, ProofStatus } from "@/types/database";

/** Texto del estado de un pedido, tal como lo ve el cliente. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente_pago: "Pendiente de pago",
  comprobante_recibido: "Comprobante en revisión",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

export const PROOF_STATUS_LABEL: Record<ProofStatus, string> = {
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};
