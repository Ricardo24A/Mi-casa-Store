"use client";

import { useActionState } from "react";
import { alternarDescuento, eliminarDescuento, type DiscountFormState } from "@/app/(admin)/admin/(panel)/descuentos/actions";
import { buttonClass } from "@/components/ui/button";
import { FormError, SubmitButton } from "@/components/ui/form-controls";

const initial: DiscountFormState = {};

/** Activar o desactivar desde la lista. */
export function DiscountToggle({ id, activo, nombre }: { id: string; activo: boolean; nombre: string }) {
  const [state, action] = useActionState(alternarDescuento, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={buttonClass("ghost", "sm")} aria-label={`${activo ? "Desactivar" : "Activar"} ${nombre}`}>
        {activo ? "Desactivar" : "Activar"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-sale-ink">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function DeleteDiscount({ id, nombre }: { id: string; nombre: string }) {
  const [state, action] = useActionState(eliminarDescuento, initial);
  return (
    <details className="max-w-md rounded-card border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-sale-ink">
        Eliminar “{nombre}”
      </summary>
      <form action={action} className="space-y-3 border-t border-line p-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-ink-soft">
          Los productos vuelven a su precio normal (o al de otro descuento que los alcance). Si solo quieres pausarlo, desactívalo.
          Los pedidos ya hechos no cambian.
        </p>
        <FormError>{state.error}</FormError>
        <SubmitButton variant="secondary" className="text-sale-ink" pendingLabel="Eliminando…">
          Eliminar definitivamente
        </SubmitButton>
      </form>
    </details>
  );
}
