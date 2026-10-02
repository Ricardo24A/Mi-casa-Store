import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { z } from "zod";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth";
import { formatUsd } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

// Panel privado: exige sesión y 2FA y no se beneficia de un armazón instantáneo. Se exime de la
// validación de navegación instantánea de Cache Components (el acceso lo sigue cuidando requireAdmin()).
export const instant = false;

export const metadata: Metadata = { title: "Pedidos" };

const PAGE_SIZE = 20;
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const dateFormat = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});

interface Row {
  referencia: string;
  estado: OrderStatus;
  total: number;
  created_at: string;
  contacto_nombre: string;
}

export default async function OrdersPage(props: PageProps<"/admin/pedidos">) {
  await requireAdmin();
  const query = await props.searchParams;
  const estado = z.enum(STATUSES as [OrderStatus, ...OrderStatus[]]).safeParse(query.estado);
  const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(query.pagina);

  // RLS: solo el administrador con 2FA ve los pedidos de todos.
  const supabase = await createClient();
  let request = supabase
    .from("orders")
    .select("referencia, estado, total, created_at, contacto_nombre", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (estado.success) request = request.eq("estado", estado.data);
  const { data, count } = await request.returns<Row[]>();
  const orders = data ?? [];
  const totalPages = Math.max(Math.ceil((count ?? 0) / PAGE_SIZE), 1);

  const href = (params: { estado?: string; pagina?: number }) => {
    const sp = new URLSearchParams();
    if (params.estado) sp.set("estado", params.estado);
    if (params.pagina && params.pagina > 1) sp.set("pagina", String(params.pagina));
    const qs = sp.toString();
    return qs ? `/admin/pedidos?${qs}` : "/admin/pedidos";
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-150",
      active ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:bg-soft",
    );

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Pedidos</h1>

      <nav aria-label="Filtrar por estado" className="mt-6 flex flex-wrap gap-2">
        <Link href={href({})} className={chip(!estado.success)} aria-current={!estado.success ? "page" : undefined}>
          Todos
        </Link>
        <Link
          href={href({ estado: "comprobante_recibido" })}
          className={chip(estado.success && estado.data === "comprobante_recibido")}
        >
          Por revisar
        </Link>
        {STATUSES.filter((s) => s !== "comprobante_recibido").map((s) => (
          <Link key={s} href={href({ estado: s })} className={chip(estado.success && estado.data === s)}>
            {ORDER_STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {orders.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-8" aria-hidden />} title="No hay pedidos">
            {estado.success ? "No hay pedidos en este estado." : "Cuando un cliente haga un pedido aparecerá aquí."}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.referencia}>
                <Link
                  href={`/admin/pedidos/${o.referencia}`}
                  className="lift flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-4 hover:border-accent/50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{o.referencia}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {o.contacto_nombre} · {dateFormat.format(new Date(o.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <OrderStatusBadge status={o.estado} />
                    <p className="min-w-20 text-right font-semibold text-ink">{formatUsd(Number(o.total))}</p>
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
            <Link href={href({ estado: estado.success ? estado.data : undefined, pagina: page - 1 })} className={buttonClass("secondary", "sm")}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-soft">
            Página {page} de {totalPages}
          </p>
          {page < totalPages ? (
            <Link href={href({ estado: estado.success ? estado.data : undefined, pagina: page + 1 })} className={buttonClass("secondary", "sm")}>
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
