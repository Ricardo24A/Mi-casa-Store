import { cn } from "@/lib/utils";
import type { ContactMessageStatus } from "@/types/database";

export const MESSAGE_STATUS_LABEL: Record<ContactMessageStatus, string> = {
  nuevo: "Nuevo",
  leido: "Leído",
  archivado: "Archivado",
};

const TONE: Record<ContactMessageStatus, string> = {
  nuevo: "bg-sale-ink text-white",
  leido: "bg-accent-soft text-accent",
  archivado: "bg-bg-alt text-ink-soft",
};

/** Estado del mensaje como etiqueta. El texto dice el estado (no solo el color). */
export function MessageStatusBadge({ status, className }: { status: ContactMessageStatus; className?: string }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", TONE[status], className)}>
      {MESSAGE_STATUS_LABEL[status]}
    </span>
  );
}
