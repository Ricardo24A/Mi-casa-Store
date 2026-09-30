import type { Metadata } from "next";
import Link from "next/link";
import { ProductWizard } from "@/components/admin/product-wizard";
import { getAdminCategoryTree } from "@/lib/admin-categories";
import { listTemplates } from "@/lib/admin-products";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  await requireAdmin();
  const [tree, templates] = await Promise.all([getAdminCategoryTree(), listTemplates()]);

  return (
    <>
      <Link href="/admin/productos" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a productos
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold tracking-tight text-ink">Nuevo producto</h1>
      <ProductWizard
        categories={tree.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          activa: c.activa,
          hijas: c.hijas.map((h) => ({ id: h.id, nombre: h.nombre, activa: h.activa })),
        }))}
        templates={templates}
      />
    </>
  );
}
