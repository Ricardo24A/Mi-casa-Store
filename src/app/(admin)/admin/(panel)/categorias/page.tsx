import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, Pencil, Plus } from "lucide-react";
import { CategoryRowControls } from "@/components/admin/category-forms";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdminCategoryTree, type AdminCategory } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Categorías" };

function Badges({ c }: { c: AdminCategory }) {
  if (!c.activa) {
    return (
      <span className="rounded-full bg-bg-alt px-2.5 py-0.5 text-xs font-semibold text-ink">
        Desactivada: no se ve en la tienda
      </span>
    );
  }
  if (!c.visible) {
    return (
      <span className="rounded-full bg-sale-soft px-2.5 py-0.5 text-xs font-semibold text-sale-ink">
        Oculta en la tienda: sin productos activos
      </span>
    );
  }
  return null;
}

function Row({ c, isFirst, isLast, nested }: { c: AdminCategory; isFirst: boolean; isLast: boolean; nested?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", nested ? "py-3 pl-4 sm:pl-8" : "p-4")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-ink", nested ? "font-semibold" : "text-lg font-semibold")}>{c.nombre}</p>
          <Badges c={c} />
        </div>
        <p className="text-sm text-ink-soft">
          {c.productos === 0
            ? "Sin productos"
            : `${c.productos} ${c.productos === 1 ? "producto" : "productos"} (${c.productosActivos} ${c.productosActivos === 1 ? "activo" : "activos"})`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <CategoryRowControls id={c.id} nombre={c.nombre} activa={c.activa} isFirst={isFirst} isLast={isLast} />
        <Link href={`/admin/categorias/${c.id}`} className={buttonClass("secondary", "sm", "gap-2")}>
          <Pencil className="size-4" aria-hidden />
          Editar
        </Link>
      </div>
    </div>
  );
}

export default async function CategoriesPage() {
  await requireAdmin();
  const tree = await getAdminCategoryTree();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Categorías</h1>
        <Link href="/admin/categorias/nueva" className={buttonClass("primary", "md", "gap-2")}>
          <Plus className="size-4" aria-hidden />
          Nueva categoría
        </Link>
      </div>
      <p className="mt-2 max-w-prose text-sm text-ink-soft">
        La tienda solo muestra las categorías y subcategorías que tienen productos activos. Aquí ves todas para poder
        dar de alta productos en cualquiera de ellas.
      </p>

      <div className="mt-6">
        {tree.length === 0 ? (
          <EmptyState icon={<FolderTree className="size-8" aria-hidden />} title="Aún no hay categorías">
            Crea la primera para empezar a agregar productos.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {tree.map((root, i) => (
              <li key={root.id} className="rounded-card border border-line bg-surface">
                <Row c={root} isFirst={i === 0} isLast={i === tree.length - 1} />
                <div className="divide-y divide-line border-t border-line">
                  {root.hijas.map((child, j) => (
                    <Row key={child.id} c={child} nested isFirst={j === 0} isLast={j === root.hijas.length - 1} />
                  ))}
                  <div className="py-1 pl-4 sm:pl-8">
                    <Link
                      href={`/admin/categorias/nueva?padre=${root.id}`}
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:underline"
                    >
                      <Plus className="size-4" aria-hidden />
                      Añadir subcategoría
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
