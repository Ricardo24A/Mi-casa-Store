import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDiscount } from "@/components/admin/discount-controls";
import { DiscountForm } from "@/components/admin/discount-form";
import { getDiscount, getDiscountFormContext } from "@/lib/admin-discounts";
import { requireAdmin } from "@/lib/auth";
import { isoToLocal } from "@/lib/discount-rules";
import { uuid } from "@/lib/validation/common";

// Panel privado: exige sesión y 2FA y no se beneficia de un armazón instantáneo. Se exime de la
// validación de navegación instantánea de Cache Components (el acceso lo sigue cuidando requireAdmin()).
export const instant = false;

export const metadata: Metadata = { title: "Editar descuento" };

export default async function EditDiscountPage(props: PageProps<"/admin/descuentos/[id]">) {
  await requireAdmin();
  const id = uuid.safeParse((await props.params).id);
  if (!id.success) notFound();

  const [discount, context] = await Promise.all([getDiscount(id.data), getDiscountFormContext(id.data)]);
  if (!discount) notFound();

  return (
    <>
      <Link href="/admin/descuentos" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a descuentos
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold tracking-tight text-ink">Editar {discount.nombre}</h1>
      <DiscountForm
        mode="editar"
        id={discount.id}
        context={context}
        defaults={{
          nombre: discount.nombre,
          tipo: discount.tipo,
          valor: String(discount.valor).replace(".", ","),
          alcance: discount.alcance,
          targetId: discount.target_id ?? "",
          inicia: isoToLocal(discount.inicia),
          termina: discount.termina ? isoToLocal(discount.termina) : "",
          activo: discount.activo,
        }}
      />
      <div className="mt-10">
        <DeleteDiscount id={discount.id} nombre={discount.nombre} />
      </div>
    </>
  );
}
