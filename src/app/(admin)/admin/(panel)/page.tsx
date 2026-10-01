import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ClipboardList, PackageX, Plus, Truck } from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getDashboardData, type OrderRow } from "@/lib/admin-dashboard";
import { requireAdmin } from "@/lib/auth";
import { formatUsd } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { averageTicket, countIn } from "@/lib/validation/admin-dashboard";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

export const metadata: Metadata = { title: "Resumen" };

const TZ = "America/Guayaquil";
const dateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
const monthName = new Intl.DateTimeFormat("es-EC", { month: "long", timeZone: TZ });
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

const card = "rounded-card border border-line bg-surface p-5";
const link = "inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 text-xl font-semibold text-ink">
      {children}
    </h2>
  );
}

function OrderLink({ o, children }: { o: OrderRow; children?: React.ReactNode }) {
  return (
    <Link
      href={`/admin/pedidos/${o.referencia}`}
      className="lift flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-line bg-bg px-3 py-2 hover:border-accent/50"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{o.referencia}</span>
        <span className="block truncate text-sm text-ink-soft">{o.contacto_nombre}</span>
      </span>
      <span className="text-right text-sm">
        <span className="block font-semibold text-ink">{formatUsd(o.total)}</span>
        <span className="block text-ink-soft">{children}</span>
      </span>
    </Link>
  );
}

function Sales({ label, pedidos, total }: { label: string; pedidos: number; total: number }) {
  const average = averageTicket(total, pedidos);
  return (
    <div className={card}>
      <p className="text-sm text-ink-soft">{label}</p>
      {pedidos === 0 ? (
        <>
          <p className="mt-1 text-3xl font-semibold text-ink">{formatUsd(0)}</p>
          <p className="mt-1 text-sm text-ink-soft">Aún no hay pedidos pagados.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-3xl font-semibold text-ink">{formatUsd(total)}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {pedidos} {pedidos === 1 ? "pedido" : "pedidos"}
            {average !== null && ` · ticket promedio ${formatUsd(average)}`}
          </p>
        </>
      )}
    </div>
  );
}

export default async function ResumenPage() {
  const { fullName } = await requireAdmin();
  const data = await getDashboardData();
  const now = new Date();

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{fullName ? `Hola, ${fullName}` : "Hola"}</h1>
      <Link href="/admin/productos/nuevo" className={buttonClass("primary", "md", "gap-2")}>
        <Plus className="size-4" aria-hidden />
        Nuevo producto
      </Link>
    </div>
  );

  if (!data) {
    return (
      <>
        {header}
        <p role="alert" className="mt-6 rounded-lg bg-sale-soft px-4 py-3 text-sm text-sale-ink">
          No pudimos cargar el resumen. Actualiza la página; si sigue igual, revisa que las migraciones estén aplicadas.
        </p>
      </>
    );
  }

  const { summary, stock, toReview, expiring, latest } = data;
  const states = summary.estados;
  const totalOrders = Object.values(states).reduce((a, b) => a + b, 0);
  const toReviewCount = countIn(states, "comprobante_recibido");
  const toShipCount = countIn(states, "pagado");
  const pendingCount = countIn(states, "pendiente_pago");

  return (
    <>
      {header}
      <p className="mt-1 text-sm text-ink-soft">Datos reales de tu tienda; si algo no tiene datos, se muestra vacío.</p>

      <section aria-labelledby="atencion" className="mt-8">
        <SectionTitle id="atencion">Requiere tu atención</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-ink">Comprobantes por revisar</h3>
              <span className="text-2xl font-semibold text-ink">{toReviewCount}</span>
            </div>
            {toReview.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No hay comprobantes esperando revisión.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {toReview.map((o) => (
                  <li key={o.referencia}>
                    <OrderLink o={o}>Pedido del {dateTime.format(new Date(o.created_at))}</OrderLink>
                  </li>
                ))}
              </ul>
            )}
            {toReviewCount > toReview.length && (
              <Link href="/admin/pedidos?estado=comprobante_recibido" className={link}>
                Ver los {toReviewCount}
              </Link>
            )}
          </div>

          <div className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-ink">Pendientes de pago</h3>
              <span className="text-2xl font-semibold text-ink">{pendingCount}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">Primero los que vencen antes; al vencer se libera su stock.</p>
            {expiring.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No hay pedidos esperando pago.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {expiring.map((o) => {
                  const expired = new Date(o.vence_en) <= now;
                  return (
                    <li key={o.referencia}>
                      <OrderLink o={o}>
                        {expired ? (
                          <span className="inline-flex items-center gap-1 text-sale-ink">
                            <AlertTriangle className="size-3.5" aria-hidden />
                            Plazo vencido
                          </span>
                        ) : (
                          `Vence ${dateTime.format(new Date(o.vence_en))}`
                        )}
                      </OrderLink>
                    </li>
                  );
                })}
              </ul>
            )}
            {pendingCount > expiring.length && (
              <Link href="/admin/pedidos?estado=pendiente_pago" className={link}>
                Ver los {pendingCount}
              </Link>
            )}
          </div>

          <div className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-ink">Pagados por enviar</h3>
              <span className="text-2xl font-semibold text-ink">{toShipCount}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">Pedidos con el pago aprobado que aún no marcas como enviados.</p>
            {toShipCount === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No tienes envíos pendientes.</p>
            ) : (
              <Link href="/admin/pedidos?estado=pagado" className={cn(link, "gap-2")}>
                <Truck className="size-4" aria-hidden />
                Ver pedidos pagados
              </Link>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="ventas" className="mt-10">
        <SectionTitle id="ventas">Ventas</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Sales label="Hoy" pedidos={summary.hoy.pedidos} total={summary.hoy.total} />
          <Sales label={`Este mes (${monthName.format(now)})`} pedidos={summary.mes.pedidos} total={summary.mes.total} />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Cuenta solo pedidos con el pago aprobado (pagados, enviados y entregados), por la fecha de aprobación, con la hora de Ecuador. No incluye pendientes,
          rechazados, cancelados ni vencidos.
        </p>
      </section>

      <section aria-labelledby="estados" className="mt-10">
        <SectionTitle id="estados">Pedidos por estado</SectionTitle>
        {totalOrders === 0 ? (
          <EmptyState icon={<ClipboardList className="size-8" aria-hidden />} title="Aún no hay pedidos">
            Cuando un cliente haga un pedido aparecerá aquí.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <li key={s}>
                <Link
                  href={`/admin/pedidos?estado=${s}`}
                  className="lift flex min-h-11 items-center justify-between gap-2 rounded-card border border-line bg-surface px-4 py-3 hover:border-accent/50"
                >
                  <span className="text-sm text-ink-soft">{ORDER_STATUS_LABEL[s]}</span>
                  <span className="text-xl font-semibold text-ink">{countIn(states, s)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="stock" className="mt-10">
        <SectionTitle id="stock">Inventario</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <StockCard
            title="Agotados"
            total={stock.agotados.total}
            items={stock.agotados.items.map((p) => ({ id: p.id, nombre: p.nombre, detail: "Sin unidades" }))}
            empty="Ningún producto activo está agotado."
            allHref="/admin/productos?estado=agotados"
          />
          <StockCard
            title="Poco stock"
            hint={`Con ${stock.umbral} unidades disponibles o menos (stock menos lo reservado por pedidos). Puedes cambiar el umbral en Configuración.`}
            total={stock.poco.total}
            items={stock.poco.items.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              detail: `${Math.max(p.stock - p.stock_reservado, 0)} disponibles${p.stock_reservado > 0 ? ` (${p.stock_reservado} reservadas)` : ""}`,
            }))}
            empty="Ningún producto activo tiene poco stock."
            allHref="/admin/productos?estado=poco"
          />
        </div>
      </section>

      <section aria-labelledby="ultimos" className="mt-10">
        <SectionTitle id="ultimos">Últimos pedidos</SectionTitle>
        {latest.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-8" aria-hidden />} title="Aún no hay pedidos">
            Cuando un cliente haga un pedido aparecerá aquí.
          </EmptyState>
        ) : (
          <>
            <ul className="space-y-3">
              {latest.map((o) => (
                <li key={o.referencia}>
                  <Link
                    href={`/admin/pedidos/${o.referencia}`}
                    className="lift flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-4 hover:border-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{o.referencia}</p>
                      <p className="truncate text-sm text-ink-soft">
                        {o.contacto_nombre} · {dateTime.format(new Date(o.created_at))}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <OrderStatusBadge status={o.estado} />
                      <p className="min-w-20 text-right font-semibold text-ink">{formatUsd(o.total)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/admin/pedidos" className={link}>
              Ver todos los pedidos
            </Link>
          </>
        )}
      </section>
    </>
  );
}

function StockCard({
  title,
  hint,
  total,
  items,
  empty,
  allHref,
}: {
  title: string;
  hint?: string;
  total: number;
  items: { id: string; nombre: string; detail: string }[];
  empty: string;
  allHref: string;
}) {
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-ink">
          <PackageX className="size-4 text-ink-soft" aria-hidden />
          {title}
        </h3>
        <span className="text-2xl font-semibold text-ink">{total}</span>
      </div>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-bg px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{p.nombre}</span>
                <span className="block text-sm text-ink-soft">{p.detail}</span>
              </span>
              <Link href={`/admin/productos/${p.id}`} className={link}>
                Editar<span className="sr-only"> {p.nombre}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <Link href={allHref} className={link}>
          Ver los {total}
        </Link>
      )}
    </div>
  );
}
