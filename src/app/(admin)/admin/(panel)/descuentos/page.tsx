import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, Pencil, Plus } from "lucide-react";
import { DiscountToggle } from "@/components/admin/discount-controls";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listDiscounts } from "@/lib/admin-discounts";
import { requireAdmin } from "@/lib/auth";
import { DISCOUNT_RULES, SCOPE_LABEL, discountValueLabel, type DiscountStatus } from "@/lib/discount-rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Descuentos" };

const STATUS: Record<DiscountStatus, { label: string; tone: string }> = {
  vigente: { label: "Vigente", tone: "bg-accent text-white" },
  programado: { label: "Programado", tone: "bg-accent-soft text-accent" },
  vencido: { label: "Vencido", tone: "bg-bg-alt text-ink-soft" },
  inactivo: { label: "Desactivado", tone: "bg-bg-alt text-ink" },
};

const dateFormat = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export default async function DiscountsPage() {
  await requireAdmin();
  // El estado (vigente, vencido...) se calcula al pedir la página.
  const discounts = await listDiscounts(new Date());

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Descuentos</h1>
        <Link href="/admin/descuentos/nuevo" className={buttonClass("primary", "md", "gap-2")}>
          <Plus className="size-4" aria-hidden />
          Nuevo descuento
        </Link>
      </div>

      <details className="mt-4 max-w-2xl rounded-card border border-line bg-surface">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-accent">Cómo se aplican los descuentos</summary>
        <ul className="list-disc space-y-1.5 border-t border-line px-8 py-4 text-sm text-ink-soft">
          {DISCOUNT_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>

      <div className="mt-6">
        {discounts.length === 0 ? (
          <EmptyState icon={<BadgePercent className="size-8" aria-hidden />} title="Aún no hay descuentos">
            Crea el primero: por porcentaje o monto fijo, para toda la tienda, una categoría o un producto.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {discounts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-card border border-line bg-surface p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{d.nombre}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS[d.status].tone)}>{STATUS[d.status].label}</span>
                    {d.codigo && (
                      <span className="rounded-full bg-sale-soft px-2.5 py-0.5 text-xs font-semibold text-sale-ink">
                        Cupón {d.codigo}: la tienda aún no los acepta
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft">
                    <span className="font-semibold text-ink">{discountValueLabel(d.tipo, d.valor)}</span> ·{" "}
                    {d.alcance === "tienda" ? SCOPE_LABEL.tienda : `${SCOPE_LABEL[d.alcance]}: ${d.targetName ?? "ya no existe"}`}
                  </p>
                  <p className="text-sm text-ink-soft">
                    Desde {dateFormat.format(new Date(d.inicia))}
                    {d.termina ? ` hasta ${dateFormat.format(new Date(d.termina))}` : ", sin fecha de fin"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <DiscountToggle id={d.id} activo={d.activo} nombre={d.nombre} />
                  <Link href={`/admin/descuentos/${d.id}`} className={buttonClass("secondary", "sm", "gap-2")}>
                    <Pencil className="size-4" aria-hidden />
                    Editar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
