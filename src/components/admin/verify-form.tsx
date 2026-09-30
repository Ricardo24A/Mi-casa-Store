"use client";

import { useActionState } from "react";
import { verificarCodigo } from "@/app/(admin)/admin/actions";
import { Field, FormError, SubmitButton } from "@/components/ui/form-controls";

export function VerifyForm({ factors }: { factors: { id: string; name: string }[] }) {
  const [state, action] = useActionState(verificarCodigo, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {factors.length > 1 ? (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink">¿Con qué dispositivo?</legend>
          <div className="space-y-1">
            {factors.map((f, i) => (
              <label key={f.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-3">
                <input type="radio" name="factorId" value={f.id} defaultChecked={i === 0} className="size-4 accent-accent" />
                <span className="text-sm text-ink">{f.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="factorId" value={factors[0]?.id ?? ""} />
      )}
      <Field
        label="Código de 6 dígitos"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        inputClassName="text-center text-xl tracking-[0.4em]"
      />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Verificando…">Verificar</SubmitButton>
    </form>
  );
}
