import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm, DeleteCategory } from "@/components/admin/category-forms";
import { getAdminCategoryTree } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/auth";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Editar categoría" };

export default async function EditCategoryPage(props: PageProps<"/admin/categorias/[id]">) {
  await requireAdmin();
  const id = uuid.safeParse((await props.params).id);
  if (!id.success) notFound();

  const tree = await getAdminCategoryTree();
  const all = tree.flatMap((c) => [c, ...c.hijas]);
  const category = all.find((c) => c.id === id.data);
  if (!category) notFound();

  const isParent = category.parentId === null;
  const parents = tree.filter((c) => c.id !== category.id).map((c) => ({ id: c.id, nombre: c.nombre }));

  return (
    <>
      <Link href="/admin/categorias" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a categorías
      </Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold tracking-tight text-ink">Editar {category.nombre}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Dirección en la tienda: <span className="font-mono text-ink">/categoria/{category.slug}</span>. Cambiar el nombre no
        cambia la dirección.
      </p>
      <CategoryForm
        mode="editar"
        id={category.id}
        nombre={category.nombre}
        parentId={category.parentId ?? ""}
        parents={parents}
        parentLocked={isParent && category.hijas.length > 0}
      />
      <div className="mt-10">
        <DeleteCategory id={category.id} nombre={category.nombre} isParent={isParent} />
      </div>
    </>
  );
}
