import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { ProofSection } from "@/components/orders/proof-section";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireCustomer } from "@/lib/auth";
import { formatUsd } from "@/lib/format";
import { ORDER_STATUS_LABEL, PROOF_STATUS_LABEL } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, ProofStatus } from "@/types/database";

export const metadata: Metadata = { title: "Mis pedidos" };

interface OrderRow {
  id: string;
  referencia: string;
  estado: OrderStatus;
  total: number;
  vence_en: string;
  created_at: string;
  payment_proofs: { estado: ProofStatus; motivo: string | null; created_at: string }[];
}

const dateFormat = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" });

export default async function OrdersPage() {
  const { userId } = await requireCustomer();

  // RLS ya limita a los pedidos propios; el filtro explícito es una segunda barrera.
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, referencia, estado, total, vence_en, created_at, payment_proofs(estado, motivo, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<OrderRow[]>();
  const orders = data ?? [];
  const now = new Date();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen className="size-8" aria-hidden />}
        title="Aún no tienes pedidos"
        action={
          <Link href="/catalogo" className={buttonClass("primary")}>
            Ver productos
          </Link>
        }
      >
        Cuando hagas una compra con esta cuenta, la verás aquí.
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        // El comprobante más reciente es el vigente.
        const proof = [...order.payment_proofs]
          .filter((p) => p.estado !== "reemplazado")
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return (
          <li key={order.id} className="rounded-card border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-ink">{order.referencia}</p>
              <p className="text-sm text-ink-soft">{dateFormat.format(new Date(order.created_at))}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                {ORDER_STATUS_LABEL[order.estado]}
              </span>
              <p className="text-lg font-semibold text-ink">{formatUsd(order.total)}</p>
            </div>
            <div className="mt-3">
              <ProofSection
                referencia={order.referencia}
                orderStatus={order.estado}
                dueAt={order.vence_en}
                now={now}
                proofs={order.payment_proofs}
                collapsed
              />
              {order.estado === "pendiente_pago" && (
                <Link
                  href={`/confirmacion/${order.referencia}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
                >
                  Ver cuentas y datos para transferir
                </Link>
              )}
            </div>
            {proof && !(order.estado === "pendiente_pago" && proof.estado === "rechazado") && (
              <p className="mt-3 text-sm text-ink-soft">
                Comprobante: <span className="font-semibold text-ink">{PROOF_STATUS_LABEL[proof.estado]}</span>
                {proof.estado === "rechazado" && proof.motivo ? `. Motivo: ${proof.motivo}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
