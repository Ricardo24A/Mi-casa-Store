import type { Metadata } from "next";
import Link from "next/link";
import { CategoryForm } from "@/components/admin/category-forms";
import { getAdminCategoryTree } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/auth";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Nueva categoría" };

export default async function NewCategoryPage(props: PageProps<"/admin/categorias/nueva">) {
  await requireAdmin();
  const { padre } = await props.searchParams;
  const tree = await getAdminCategoryTree();
  const parents = tree.map((c) => ({ id: c.id, nombre: c.nombre }));
  // Solo se acepta un padre que exista y sea de primer nivel.
  const presetParent = uuid.safeParse(padre).success && parents.some((p) => p.id === padre) ? (padre as string) : "";

  return (
    <>
      <Link href="/admin/categorias" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a categorías
      </Link>
      <h1 className="mb-6 mt-2 text-3xl font-semibold tracking-tight text-ink">
        {presetParent ? "Nueva subcategoría" : "Nueva categoría"}
      </h1>
      <CategoryForm mode="crear" nombre="" parentId={presetParent} parents={parents} />
    </>
  );
}
