import type { Metadata } from "next";
import Link from "next/link";
import { DiscountForm } from "@/components/admin/discount-form";
import { getDiscountFormContext } from "@/lib/admin-discounts";
import { requireAdmin } from "@/lib/auth";

// Panel privado: exige sesión y 2FA y no se beneficia de un armazón instantáneo. Se exime de la
// validación de navegación instantánea de Cache Components (el acceso lo sigue cuidando requireAdmin()).
export const instant = false;

export const metadata: Metadata = { title: "Nuevo descuento" };

export default async function NewDiscountPage() {
  await requireAdmin();
  const context = await getDiscountFormContext();

  return (
    <>
      <Link href="/admin/descuentos" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a descuentos
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold tracking-tight text-ink">Nuevo descuento</h1>
      <DiscountForm
        mode="crear"
        context={context}
        defaults={{ nombre: "", tipo: "porcentaje", valor: "", alcance: "tienda", targetId: "", inicia: "", termina: "", activo: true }}
      />
    </>
  );
}
