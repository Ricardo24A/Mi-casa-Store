"use client";

import { useActionState } from "react";
import { Archive, MailOpen } from "lucide-react";
import { archivarMensaje, marcarLeido, type MessageActionState } from "@/app/(admin)/admin/(panel)/mensajes/actions";
import { buttonClass } from "@/components/ui/button";
import { FormError, FormSuccess } from "@/components/ui/form-controls";
import type { ContactMessageStatus } from "@/types/database";

const initial: MessageActionState = {};

function ActionButton({
  id,
  action,
  label,
  pendingLabel,
  variant,
  icon,
}: {
  id: string;
  action: (prev: MessageActionState, formData: FormData) => Promise<MessageActionState>;
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary";
  icon: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={buttonClass(variant, "lg", "w-full gap-2")}>
        {icon}
        {pending ? pendingLabel : label}
      </button>
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.ok}</FormSuccess>
    </form>
  );
}

/** "Marcar leído" (solo si es nuevo) y "Archivar" (nuevo o leído). La base de datos vuelve a verificar el estado. */
export function MessageActions({ id, status }: { id: string; status: ContactMessageStatus }) {
  if (status === "archivado") {
    return <p className="text-sm text-ink-soft">Este mensaje está archivado.</p>;
  }
  return (
    <div className="space-y-3">
      {status === "nuevo" && (
        <ActionButton
          id={id}
          action={marcarLeido}
          label="Marcar leído"
          pendingLabel="Guardando…"
          variant="primary"
          icon={<MailOpen className="size-4" aria-hidden />}
        />
      )}
      <ActionButton
        id={id}
        action={archivarMensaje}
        label="Archivar"
        pendingLabel="Archivando…"
        variant="secondary"
        icon={<Archive className="size-4" aria-hidden />}
      />
    </div>
  );
}
