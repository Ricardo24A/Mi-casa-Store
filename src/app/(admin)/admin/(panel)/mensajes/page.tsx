import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { z } from "zod";
import { MessageStatusBadge } from "@/components/admin/message-status";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ContactMessage, ContactMessageStatus } from "@/types/database";

// Panel privado: exige sesión y 2FA y no se beneficia de un armazón instantáneo. Se exime de la
// validación de navegación instantánea de Cache Components (el acceso lo sigue cuidando requireAdmin()).
export const instant = false;

export const metadata: Metadata = { title: "Mensajes" };

const PAGE_SIZE = 20;
const FILTERS: { estado: ContactMessageStatus; label: string; empty: string }[] = [
  { estado: "nuevo", label: "Nuevos", empty: "No tienes mensajes nuevos." },
  { estado: "leido", label: "Leídos", empty: "No hay mensajes leídos." },
  { estado: "archivado", label: "Archivados", empty: "No hay mensajes archivados." },
];
const dateFormat = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});

type Row = Pick<ContactMessage, "id" | "nombre" | "asunto" | "mensaje" | "estado" | "created_at">;

export default async function MessagesPage(props: PageProps<"/admin/mensajes">) {
  await requireAdmin();
  const query = await props.searchParams;
  // Sin filtro: los nuevos, que son los que piden respuesta.
  const estado = z.enum(["nuevo", "leido", "archivado"]).catch("nuevo").parse(query.estado);
  const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(query.pagina);
  const filter = FILTERS.find((f) => f.estado === estado)!;

  // RLS: solo el administrador con 2FA lee los mensajes.
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("contact_messages")
    .select("id, nombre, asunto, mensaje, estado, created_at", { count: "exact" })
    .eq("estado", estado)
    .order("created_at", { ascending: estado === "nuevo" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .returns<Row[]>();
  const messages = data ?? [];
  const totalPages = Math.max(Math.ceil((count ?? 0) / PAGE_SIZE), 1);

  const href = (params: { estado: ContactMessageStatus; pagina?: number }) => {
    const sp = new URLSearchParams();
    if (params.estado !== "nuevo") sp.set("estado", params.estado);
    if (params.pagina && params.pagina > 1) sp.set("pagina", String(params.pagina));
    const qs = sp.toString();
    return qs ? `/admin/mensajes?${qs}` : "/admin/mensajes";
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-150",
      active ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-soft",
    );

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Mensajes</h1>
      <p className="mt-1 text-sm text-ink-soft">Lo que te escriben desde la página de contacto de la tienda.</p>

      <nav aria-label="Filtrar por estado" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.estado} href={href({ estado: f.estado })} className={chip(f.estado === estado)} aria-current={f.estado === estado ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {error ? (
          <p role="alert" className="rounded-lg bg-sale-soft px-4 py-3 text-sm text-sale-ink">
            No pudimos cargar los mensajes. Actualiza la página; si sigue igual, revisa que las migraciones estén aplicadas.
          </p>
        ) : messages.length === 0 ? (
          <EmptyState icon={<Inbox className="size-8" aria-hidden />} title="No hay mensajes">
            {filter.empty}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/mensajes/${m.id}`}
                  className="lift flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-4 hover:border-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-ink", m.estado === "nuevo" ? "font-semibold" : undefined)}>
                      {m.nombre}
                      {m.asunto && <span className="text-ink-soft"> · {m.asunto}</span>}
                    </p>
                    <p className="truncate text-sm text-ink-soft">{m.mensaje}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-ink-soft">{dateFormat.format(new Date(m.created_at))}</p>
                    <MessageStatusBadge status={m.estado} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link href={href({ estado, pagina: page - 1 })} className={buttonClass("secondary", "sm")}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-soft">
            Página {page} de {totalPages}
          </p>
          {page < totalPages ? (
            <Link href={href({ estado, pagina: page + 1 })} className={buttonClass("secondary", "sm")}>
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
