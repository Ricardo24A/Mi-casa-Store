// Qué puede hacer el comprador con el comprobante de un pedido. Es solo para decidir qué mostrar;
// la base de datos (`submit_payment_proof`) vuelve a comprobar todo con el pedido bloqueado.
// Sin `@/` a propósito, para probarlo con node:test.

/** Máximo de comprobantes por pedido (activos + historial). */
export const MAX_PROOFS = 3;

export type ProofState = "en_revision" | "aprobado" | "rechazado" | "reemplazado";

export interface ProofSummary {
  estado: ProofState;
  motivo: string | null;
  created_at: string;
}

export type ProofAction =
  | { kind: "subir"; remaining: number }
  | { kind: "reemplazar"; remaining: number }
  | { kind: "ninguna"; reason: "vencido" | "aprobado" | "limite" | "estado" };

/** El comprobante vigente: en revisión o aprobado (solo hay uno por pedido). */
export function activeProof(proofs: readonly ProofSummary[]): ProofSummary | null {
  return proofs.find((p) => p.estado === "en_revision" || p.estado === "aprobado") ?? null;
}

/** Último comprobante rechazado, para mostrar su motivo al comprador. */
export function lastRejected(proofs: readonly ProofSummary[]): ProofSummary | null {
  return (
    [...proofs]
      .filter((p) => p.estado === "rechazado")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

export function proofAction(input: {
  orderStatus: string;
  /** vence_en del pedido (ISO). NO se reinicia con un reemplazo. */
  dueAt: string;
  now: Date;
  proofs: readonly ProofSummary[];
}): ProofAction {
  const { orderStatus, dueAt, now, proofs } = input;
  const remaining = Math.max(MAX_PROOFS - proofs.length, 0);
  const expired = new Date(dueAt).getTime() <= now.getTime();

  if (orderStatus === "pendiente_pago") {
    if (expired) return { kind: "ninguna", reason: "vencido" };
    if (remaining === 0) return { kind: "ninguna", reason: "limite" };
    return { kind: "subir", remaining };
  }

  if (orderStatus === "comprobante_recibido") {
    const active = activeProof(proofs);
    if (!active) return { kind: "ninguna", reason: "estado" };
    if (active.estado === "aprobado") return { kind: "ninguna", reason: "aprobado" };
    if (expired) return { kind: "ninguna", reason: "vencido" };
    if (remaining === 0) return { kind: "ninguna", reason: "limite" };
    return { kind: "reemplazar", remaining };
  }

  return { kind: "ninguna", reason: "estado" };
}
