import { ProofUploader } from "@/components/orders/proof-uploader";
import { lastRejected, proofAction, type ProofSummary } from "@/lib/proof-rules";

const WHY: Record<"vencido" | "aprobado" | "limite" | "estado", string | null> = {
  vencido: "El plazo de este pedido venció, así que ya no se puede subir ni cambiar el comprobante.",
  aprobado: "Tu comprobante ya fue aprobado y no se puede cambiar.",
  limite: "Ya subiste 3 comprobantes para este pedido, que es el máximo.",
  estado: null,
};

/**
 * Lo que el comprador puede hacer con el comprobante de un pedido: subirlo, reemplazarlo mientras
 * esté en revisión, o nada (aprobado, vencido, tope). `collapsed`: dentro de un desplegable (Mis pedidos).
 * Es solo la vista: el servidor y la base de datos vuelven a comprobar cada regla.
 */
export function ProofSection({
  referencia,
  orderStatus,
  dueAt,
  now,
  proofs,
  collapsed = false,
}: {
  referencia: string;
  orderStatus: string;
  dueAt: string;
  now: Date;
  proofs: ProofSummary[];
  collapsed?: boolean;
}) {
  const action = proofAction({ orderStatus, dueAt, now, proofs });
  if (action.kind === "ninguna") {
    const why = WHY[action.reason];
    return why ? <p className="text-sm text-ink-soft">{why}</p> : null;
  }

  const rejected = orderStatus === "pendiente_pago" ? lastRejected(proofs) : null;
  const replacing = action.kind === "reemplazar";

  const body = (
    <div className="space-y-3">
      {rejected && (
        <p role="status" className="rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">
          Tu comprobante anterior fue rechazado{rejected.motivo ? `: ${rejected.motivo}` : "."} Sube uno nuevo.
        </p>
      )}
      {replacing && (
        <p className="text-sm text-ink-soft">
          ¿Subiste el archivo equivocado? Mientras lo revisamos puedes cambiarlo (te quedan{" "}
          {action.remaining === 1 ? "1 cambio" : `${action.remaining} cambios`}). El plazo del pedido no se reinicia.
        </p>
      )}
      <ProofUploader referencia={referencia} mode={replacing ? "reemplazar" : "subir"} />
    </div>
  );

  if (!collapsed && !replacing) return body;
  return (
    <details className="rounded-lg border border-line bg-soft">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-accent">
        {replacing ? "Reemplazar comprobante" : "Subir comprobante"}
      </summary>
      <div className="border-t border-line p-4">{body}</div>
    </details>
  );
}
