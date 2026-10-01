import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import { OrderActions } from "@/components/admin/order-actions";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { requireAdmin } from "@/lib/auth";
import { formatUsd } from "@/lib/format";
import { PROOF_STATUS_LABEL } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, ProofStatus } from "@/types/database";

export const metadata: Metadata = { title: "Detalle del pedido" };

const referenciaSchema = z.string().regex(/^MC-[A-Z2-9]{8}$/);
const SIGNED_URL_SECONDS = 300;
const dateFormat = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});

interface Proof {
  id: string;
  archivo: string;
  hash: string;
  estado: ProofStatus;
  motivo: string | null;
  created_at: string;
  revisado_en: string | null;
}
interface Order {
  id: string;
  referencia: string;
  estado: OrderStatus;
  contacto_nombre: string;
  contacto_email: string;
  contacto_telefono: string;
  direccion_envio: Record<string, string | null>;
  subtotal: number;
  descuento: number;
  descuento_transferencia: number;
  envio: number;
  total: number;
  motivo_estado: string | null;
  vence_en: string;
  pagado_en: string | null;
  enviado_en: string | null;
  entregado_en: string | null;
  created_at: string;
  order_items: { nombre: string; precio_unitario: number; cantidad: number }[];
  payment_proofs: Proof[];
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={strong ? "font-semibold text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}

export default async function OrderDetailPage(props: PageProps<"/admin/pedidos/[referencia]">) {
  await requireAdmin();
  const referencia = referenciaSchema.safeParse((await props.params).referencia);
  if (!referencia.success) notFound();

  // RLS: solo el administrador con 2FA ve pedidos ajenos.
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, referencia, estado, contacto_nombre, contacto_email, contacto_telefono, direccion_envio, subtotal, descuento, descuento_transferencia, envio, total, motivo_estado, vence_en, pagado_en, enviado_en, entregado_en, created_at, order_items(nombre, precio_unitario, cantidad), payment_proofs(id, archivo, hash, estado, motivo, created_at, revisado_en)",
    )
    .eq("referencia", referencia.data)
    .maybeSingle<Order>();
  if (!order) notFound();

  const proofs = [...order.payment_proofs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const active = proofs.find((p) => p.estado === "en_revision" || p.estado === "aprobado") ?? null;

  // URL firmada y temporal del archivo vigente: el bucket es privado. Solo se firma tras requireAdmin().
  const admin = createAdminClient();
  let proofUrl: string | null = null;
  if (active) {
    const { data } = await admin.storage.from("payment-proofs").createSignedUrl(active.archivo, SIGNED_URL_SECONDS);
    proofUrl = data?.signedUrl ?? null;
  }
  const isPdf = active?.archivo.toLowerCase().endsWith(".pdf") ?? false;

  // Aviso para el dueño (nunca para el comprador): el mismo archivo en otro pedido.
  let duplicates: string[] = [];
  if (active) {
    const { data } = await admin
      .from("payment_proofs")
      .select("estado, orders!inner(referencia)")
      .eq("hash", active.hash)
      .neq("order_id", order.id)
      .neq("estado", "reemplazado");
    duplicates = [
      ...new Set((data ?? []).map((d) => (d.orders as unknown as { referencia: string }).referencia)),
    ];
  }

  const ship = order.direccion_envio ?? {};
  const history = proofs.filter((p) => p.id !== active?.id);

  return (
    <>
      <Link href="/admin/pedidos" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a pedidos
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{order.referencia}</h1>
        <OrderStatusBadge status={order.estado} />
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Creado el {dateFormat.format(new Date(order.created_at))}
        {(order.estado === "pendiente_pago" || order.estado === "comprobante_recibido") &&
          ` · Plazo para pagar: ${dateFormat.format(new Date(order.vence_en))}`}
      </p>
      {(order.pagado_en || order.enviado_en || order.entregado_en) && (
        <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
          {order.pagado_en && <li>Pago aprobado el {dateFormat.format(new Date(order.pagado_en))}</li>}
          {order.enviado_en && <li>Enviado el {dateFormat.format(new Date(order.enviado_en))}</li>}
          {order.entregado_en && <li>Entregado el {dateFormat.format(new Date(order.entregado_en))}</li>}
        </ul>
      )}
      {order.motivo_estado && (
        <p className="mt-3 rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">Motivo: {order.motivo_estado}</p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-8">
          <section aria-labelledby="comprobante">
            <h2 id="comprobante" className="mb-3 text-xl font-semibold text-ink">
              Comprobante
            </h2>
            {active && proofUrl ? (
              <div className="space-y-3 rounded-card border border-line bg-surface p-4">
                <p className="text-sm text-ink-soft">
                  {PROOF_STATUS_LABEL[active.estado]} · subido el {dateFormat.format(new Date(active.created_at))}
                </p>
                {duplicates.length > 0 && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Este mismo archivo también aparece en {duplicates.length === 1 ? "el pedido" : "los pedidos"}{" "}
                    {duplicates.join(", ")}. Revisa con cuidado.
                  </p>
                )}
                {isPdf ? (
                  <a
                    href={proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline"
                  >
                    Abrir el PDF en otra pestaña
                  </a>
                ) : (
                  // Imagen firmada y temporal, de un bucket privado: next/image no aporta aquí.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proofUrl} alt={`Comprobante del pedido ${order.referencia}`} className="max-h-[32rem] w-full rounded-lg border border-line bg-white object-contain" />
                )}
                <p className="text-xs text-ink-soft">
                  El enlace del archivo es privado y vence en {SIGNED_URL_SECONDS / 60} minutos; actualiza la página para
                  verlo de nuevo.
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Este pedido no tiene un comprobante vigente.</p>
            )}

            {history.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-ink">Historial de comprobantes</h3>
                <ul className="space-y-2 text-sm text-ink-soft">
                  {history.map((p) => (
                    <li key={p.id} className="rounded-lg border border-line bg-surface px-3 py-2">
                      <span className="font-semibold text-ink">{PROOF_STATUS_LABEL[p.estado]}</span> ·{" "}
                      {dateFormat.format(new Date(p.created_at))}
                      {p.motivo ? ` · Motivo: ${p.motivo}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="productos">
            <h2 id="productos" className="mb-3 text-xl font-semibold text-ink">
              Productos
            </h2>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {order.order_items.map((item, i) => (
                <li key={`${item.nombre}-${i}`} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-ink">
                    {item.cantidad} × {item.nombre}
                  </span>
                  <span className="font-semibold text-ink">{formatUsd(Number(item.precio_unitario) * item.cantidad)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={formatUsd(Number(order.subtotal))} />
              {Number(order.descuento) > 0 && <Row label="Descuentos" value={`−${formatUsd(Number(order.descuento))}`} />}
              {Number(order.descuento_transferencia) > 0 && (
                <Row label="Descuento por transferencia" value={`−${formatUsd(Number(order.descuento_transferencia))}`} />
              )}
              <Row label="Envío" value={Number(order.envio) === 0 ? "Gratis" : formatUsd(Number(order.envio))} />
              <Row label="Total a recibir" value={formatUsd(Number(order.total))} strong />
            </dl>
          </section>

          <section aria-labelledby="cliente" className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 id="cliente" className="mb-2 text-xl font-semibold text-ink">
                Cliente
              </h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">{order.contacto_nombre}</span>
                <br />
                {order.contacto_email}
                <br />
                {order.contacto_telefono}
              </p>
            </div>
            <div>
              <h2 className="mb-2 text-xl font-semibold text-ink">Entrega</h2>
              <address className="text-sm not-italic leading-relaxed text-ink-soft">
                {ship.destinatario}
                <br />
                {ship.direccion}
                <br />
                {ship.ciudad}, {ship.provincia}
                {ship.referencia && (
                  <>
                    <br />
                    Ref.: {ship.referencia}
                  </>
                )}
              </address>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-3 text-xl font-semibold text-ink">Acciones</h2>
          <OrderActions orderId={order.id} status={order.estado} activeProofId={active?.estado === "en_revision" ? active.id : null} />
        </aside>
      </div>
    </>
  );
}
