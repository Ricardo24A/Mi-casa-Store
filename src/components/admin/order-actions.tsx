"use client";

import { useActionState } from "react";
import {
  aprobarPedido,
  cancelarPedido,
  rechazarComprobante,
  rechazarPedido,
  type OrderActionState,
} from "@/app/(admin)/admin/(panel)/pedidos/actions";
import { FormError, FormSuccess, SubmitButton, inputClass } from "@/components/ui/form-controls";

const initial: OrderActionState = {};

function Result({ state }: { state: OrderActionState }) {
  return (
    <>
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.ok}</FormSuccess>
    </>
  );
}

function ReasonForm({
  title,
  description,
  action,
  hidden,
  button,
  danger,
}: {
  title: string;
  description: string;
  action: (prev: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  hidden: Record<string, string>;
  button: string;
  danger?: boolean;
}) {
  const [state, formAction] = useActionState(action, initial);
  const id = `motivo-${button.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-ink">{title}</summary>
      <form action={formAction} className="space-y-3 border-t border-line p-4" noValidate>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <p className="text-sm text-ink-soft">{description}</p>
        <div>
          <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
            Motivo (lo verá el cliente)
          </label>
          <textarea id={id} name="motivo" rows={3} maxLength={500} required className={inputClass} />
        </div>
        <Result state={state} />
        <SubmitButton
          variant={danger ? "secondary" : "primary"}
          className={danger ? "text-sale-ink" : undefined}
          pendingLabel="Guardando…"
        >
          {button}
        </SubmitButton>
      </form>
    </details>
  );
}

/** Botones de cada cambio de estado permitido; la base de datos vuelve a verificar todo. */
export function OrderActions({
  orderId,
  status,
  activeProofId,
}: {
  orderId: string;
  status: string;
  activeProofId: string | null;
}) {
  const [approveState, approveAction] = useActionState(aprobarPedido, initial);

  if (status === "comprobante_recibido" && activeProofId) {
    return (
      <div className="space-y-3">
        <form action={approveAction} className="space-y-3 rounded-card border border-line bg-surface p-4" noValidate>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="proofId" value={activeProofId} />
          <p role="note" className="rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">
            Aprueba solo después de ver el dinero reflejado en tu cuenta bancaria. Un comprobante puede ser falso o
            estar editado: no te bases solo en la imagen.
          </p>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" name="verificado" className="mt-1 size-5 accent-accent" />
            <span className="text-sm text-ink">Verifiqué en mi cuenta que el dinero llegó por el monto exacto.</span>
          </label>
          <Result state={approveState} />
          <SubmitButton pendingLabel="Aprobando…">Aprobar pago y descontar stock</SubmitButton>
        </form>

        <ReasonForm
          title="Rechazar comprobante"
          description="El cliente podrá subir otro y tendrá un plazo nuevo. El stock sigue reservado."
          action={rechazarComprobante}
          hidden={{ orderId, proofId: activeProofId }}
          button="Rechazar comprobante"
        />
        <ReasonForm
          title="Rechazar el pedido"
          description="Es definitivo: el pedido se cierra y el stock reservado vuelve a estar disponible."
          action={rechazarPedido}
          hidden={{ orderId }}
          button="Rechazar pedido"
          danger
        />
        <ReasonForm
          title="Cancelar el pedido"
          description="El pedido se cancela y el stock reservado vuelve a estar disponible."
          action={cancelarPedido}
          hidden={{ orderId }}
          button="Cancelar pedido"
          danger
        />
      </div>
    );
  }

  if (status === "pendiente_pago") {
    return (
      <ReasonForm
        title="Cancelar el pedido"
        description="El pedido se cancela y el stock reservado vuelve a estar disponible."
        action={cancelarPedido}
        hidden={{ orderId }}
        button="Cancelar pedido"
        danger
      />
    );
  }

  return <p className="text-sm text-ink-soft">No hay acciones disponibles en este estado.</p>;
}
