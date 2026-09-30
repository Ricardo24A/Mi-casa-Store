import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AdminCategory {
  id: string;
  parentId: string | null;
  nombre: string;
  slug: string;
  orden: number;
  activa: boolean;
  /** La tienda la muestra: está activa y tiene productos activos (sección 4 de CLAUDE.md). */
  visible: boolean;
  /** Productos en total y activos (en una categoría de primer nivel, suman los de sus subcategorías). */
  productos: number;
  productosActivos: number;
  hijas: AdminCategory[];
}

interface CategoryRow {
  id: string;
  parent_id: string | null;
  nombre: string;
  slug: string;
  orden: number;
  activa: boolean;
}

const byOrder = (a: AdminCategory, b: AdminCategory) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");

/**
 * Todas las categorías para el dashboard (con las desactivadas y las vacías), en dos niveles.
 * Solo se llama tras `requireAdmin()`: RLS deja ver todos los productos únicamente al admin con 2FA.
 */
export async function getAdminCategoryTree(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: products }, { data: visible }] = await Promise.all([
    supabase.from("categories").select("id, parent_id, nombre, slug, orden, activa").returns<CategoryRow[]>(),
    supabase.from("products").select("category_id, activo").limit(50_000),
    supabase.from("visible_categories").select("id"),
  ]);

  const visibleIds = new Set((visible ?? []).map((v) => v.id as string));
  const counts = new Map<string, { total: number; activos: number }>();
  for (const p of products ?? []) {
    const c = counts.get(p.category_id) ?? { total: 0, activos: 0 };
    c.total += 1;
    if (p.activo) c.activos += 1;
    counts.set(p.category_id, c);
  }

  const node = (r: CategoryRow): AdminCategory => {
    const c = counts.get(r.id);
    return {
      id: r.id,
      parentId: r.parent_id,
      nombre: r.nombre,
      slug: r.slug,
      orden: r.orden,
      activa: r.activa,
      visible: visibleIds.has(r.id),
      productos: c?.total ?? 0,
      productosActivos: c?.activos ?? 0,
      hijas: [],
    };
  };

  const all = (rows ?? []).map(node);
  const roots = all.filter((c) => c.parentId === null);
  for (const root of roots) {
    root.hijas = all.filter((c) => c.parentId === root.id).sort(byOrder);
    root.productos = root.hijas.reduce((n, h) => n + h.productos, 0);
    root.productosActivos = root.hijas.reduce((n, h) => n + h.productosActivos, 0);
  }
  return roots.sort(byOrder);
}
