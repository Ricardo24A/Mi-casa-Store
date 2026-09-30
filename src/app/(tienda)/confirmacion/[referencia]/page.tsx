import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { ProofSection } from "@/components/orders/proof-section";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { requireCustomer } from "@/lib/auth";
import { formatUsd } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProofSummary } from "@/lib/proof-rules";
import type { OrderStatus } from "@/types/database";
import { z } from "zod";

export const metadata: Metadata = {
  title: "Pedido creado",
  robots: { index: false, follow: false },
};

const referenciaSchema = z.string().regex(/^MC-[A-Z2-9]{8}$/);
const deadlineFormat = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});

interface BankAccount {
  banco: string;
  tipo: "ahorros" | "corriente";
  numero: string;
  titular: string;
  identificacion: string;
}

async function ConfirmationContent({ params }: { params: PageProps<"/confirmacion/[referencia]">["params"] }) {
  const { userId } = await requireCustomer();
  const referencia = referenciaSchema.safeParse((await params).referencia);
  if (!referencia.success) notFound();

  // RLS: solo el dueño ve su pedido; el filtro por user_id es una segunda barrera.
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, referencia, total, vence_en, estado, payment_proofs(estado, motivo, created_at)")
    .eq("referencia", referencia.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!order) notFound();

  // Las cuentas bancarias solo las lee el servidor (el comprador las ve por ser dueño del pedido).
  const { data: settings } = await createAdminClient()
    .from("store_settings")
    .select("cuentas_bancarias")
    .maybeSingle();
  const accounts = (settings?.cuentas_bancarias ?? []) as BankAccount[];

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-2xl">
        <p className="flex items-center gap-2 font-semibold text-accent">
          <CheckCircle2 className="size-5" aria-hidden /> Pedido creado
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{order.referencia}</h1>

        <dl className="mt-6 grid gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-soft">Monto exacto a transferir</dt>
            <dd className="text-2xl font-semibold text-ink">{formatUsd(Number(order.total))}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Concepto de la transferencia</dt>
            <dd className="text-2xl font-semibold text-ink">{order.referencia}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-ink-soft">Tienes tiempo hasta</dt>
            <dd className="font-semibold text-ink">{deadlineFormat.format(new Date(order.vence_en))}</dd>
          </div>
        </dl>

        <h2 className="mb-3 mt-8 text-xl font-semibold text-ink">Cuentas para la transferencia</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-soft">Las cuentas bancarias se mostrarán aquí cuando el negocio las registre.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => (
              <li key={a.numero} className="rounded-card border border-line bg-surface p-4 text-sm">
                <p className="font-semibold text-ink">{a.banco}</p>
                <p className="text-ink-soft">
                  Cuenta de {a.tipo} · {a.numero}
                </p>
                <p className="text-ink-soft">
                  {a.titular} · {a.identificacion}
                </p>
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="comprobante" className="mt-8">
          <h2 id="comprobante" className="mb-3 text-xl font-semibold text-ink">
            Comprobante de pago
          </h2>
          {order.estado === "pendiente_pago" && (
            <p className="mb-4 text-sm text-ink-soft">
              Haz la transferencia por el monto exacto, con la referencia como concepto, y sube aquí la foto o
              el PDF del comprobante. El pedido queda confirmado cuando lo subes; se marca como pagado cuando
              lo revisemos.
            </p>
          )}
          {order.estado === "comprobante_recibido" && (
            <p role="status" className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
              Recibimos tu comprobante, lo revisaremos.
            </p>
          )}
          {order.estado !== "pendiente_pago" && order.estado !== "comprobante_recibido" && (
            <p className="mb-4 text-sm text-ink-soft">
              Estado del pedido:{" "}
              <span className="font-semibold text-ink">{ORDER_STATUS_LABEL[order.estado as OrderStatus]}</span>
            </p>
          )}
          <ProofSection
            referencia={order.referencia}
            orderStatus={order.estado}
            dueAt={order.vence_en}
            now={new Date()}
            proofs={(order.payment_proofs ?? []) as ProofSummary[]}
          />
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/cuenta" className={buttonClass("primary")}>
            Ver mis pedidos
          </Link>
          <Link href="/catalogo" className={buttonClass("secondary")}>
            Seguir comprando
          </Link>
        </div>
      </div>
    </Container>
  );
}

export default function ConfirmationPage(props: PageProps<"/confirmacion/[referencia]">) {
  return (
    <Suspense fallback={<Container className="py-10" aria-busy="true"><div className="h-64" /></Container>}>
      <ConfirmationContent params={props.params} />
    </Suspense>
  );
}
