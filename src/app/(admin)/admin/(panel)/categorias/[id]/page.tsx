import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm, DeleteCategory } from "@/components/admin/category-forms";
import { CategoryImageManager } from "@/components/admin/product-edit";
import { getAdminCategoryTree } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";

// Panel privado: exige sesión y 2FA y no se beneficia de un armazón instantáneo. Se exime de la
// validación de navegación instantánea de Cache Components (el acceso lo sigue cuidando requireAdmin()).
export const instant = false;

export const metadata: Metadata = { title: "Editar categoría" };

export default async function EditCategoryPage(props: PageProps<"/admin/categorias/[id]">) {
  await requireAdmin();
  const id = uuid.safeParse((await props.params).id);
  if (!id.success) notFound();

  const tree = await getAdminCategoryTree();
  const all = tree.flatMap((c) => [c, ...c.hijas]);
  const category = all.find((c) => c.id === id.data);
  if (!category) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase.from("categories").select("imagen_url").eq("id", category.id).maybeSingle();
  const imageUrl = row?.imagen_url ? publicImageUrl(row.imagen_url as string) : null;

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
      <section aria-labelledby="imagen" className="mt-10">
        <h2 id="imagen" className="mb-3 text-xl font-semibold text-ink">
          Imagen (opcional)
        </h2>
        <CategoryImageManager categoryId={category.id} imageUrl={imageUrl} />
      </section>

      <div className="mt-10">
        <DeleteCategory id={category.id} nombre={category.nombre} isParent={isParent} />
      </div>
    </>
  );
}
