import "server-only";
import { getAdminCategoryTree, type AdminCategory } from "@/lib/admin-categories";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/supabase/public";

export const PAGE_SIZE = 20;

export const STOCK_FILTERS = ["todos", "activos", "inactivos", "agotados", "poco"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export interface ProductFilters {
  q?: string;
  /** Categoría o subcategoría. */
  categoryId?: string;
  estado: StockFilter;
  pagina: number;
}

export interface AdminProductRow {
  id: string;
  nombre: string;
  slug: string;
  sku: string | null;
  precio: number;
  stock: number;
  stockReservado: number;
  activo: boolean;
  destacado: boolean;
  categoria: string;
  imagen: string | null;
}

interface Row {
  id: string;
  nombre: string;
  slug: string;
  sku: string | null;
  precio: number;
  stock: number;
  stock_reservado: number;
  activo: boolean;
  destacado: boolean;
  category_id: string;
  product_images: { url: string; orden: number }[] | null;
}

/** Umbral de "poco stock" de Configuración (5 por defecto). */
export async function getLowStockThreshold(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("umbral_stock_bajo").maybeSingle();
  return Number(data?.umbral_stock_bajo ?? 5);
}

/** Subcategorías con el nombre de su categoría, para los selectores ("Cocina › Utensilios"). */
export function subcategoryOptions(tree: AdminCategory[]) {
  return tree.flatMap((root) => root.hijas.map((sub) => ({ id: sub.id, label: `${root.nombre} › ${sub.nombre}`, activa: sub.activa && root.activa })));
}

/** Listado del dashboard con búsqueda y filtros. Solo tras `requireAdmin()`: RLS deja ver todos los productos al admin con 2FA. */
export async function listProducts(filters: ProductFilters, threshold: number) {
  const supabase = await createClient();
  const tree = await getAdminCategoryTree();
  const names = new Map<string, string>();
  for (const root of tree) for (const sub of root.hijas) names.set(sub.id, `${root.nombre} › ${sub.nombre}`);

  let query = supabase
    .from("products")
    .select(
      "id, nombre, slug, sku, precio, stock, stock_reservado, activo, destacado, category_id, product_images(url, orden)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((filters.pagina - 1) * PAGE_SIZE, filters.pagina * PAGE_SIZE - 1);

  if (filters.q) {
    // Los caracteres , ( ) y % _ rompen el filtro `or` de PostgREST y los comodines de LIKE.
    const q = filters.q.replace(/[,()%_\\]/g, " ").trim().slice(0, 80);
    if (q) query = query.or(`nombre.ilike.%${q}%,sku.ilike.%${q}%`);
  }
  if (filters.categoryId) {
    const root = tree.find((c) => c.id === filters.categoryId);
    const ids = root ? root.hijas.map((h) => h.id) : [filters.categoryId];
    query = query.in("category_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  switch (filters.estado) {
    case "activos":
      query = query.eq("activo", true);
      break;
    case "inactivos":
      query = query.eq("activo", false);
      break;
    case "agotados":
      query = query.eq("stock", 0);
      break;
    case "poco":
      query = query.lte("stock", threshold);
      break;
  }

  const { data, count } = await query.returns<Row[]>();
  const rows: AdminProductRow[] = (data ?? []).map((r) => {
    const cover = [...(r.product_images ?? [])].sort((a, b) => a.orden - b.orden)[0];
    return {
      id: r.id,
      nombre: r.nombre,
      slug: r.slug,
      sku: r.sku,
      precio: Number(r.precio),
      stock: r.stock,
      stockReservado: r.stock_reservado,
      activo: r.activo,
      destacado: r.destacado,
      categoria: names.get(r.category_id) ?? "Sin subcategoría",
      imagen: cover ? publicImageUrl(cover.url) : null,
    };
  });
  return { rows, total: count ?? 0, tree };
}

export interface AdminProductDetail {
  id: string;
  categoryId: string;
  nombre: string;
  slug: string;
  descripcion: string;
  precio: number;
  stock: number;
  stockReservado: number;
  sku: string | null;
  activo: boolean;
  destacado: boolean;
  images: { id: string; path: string; url: string; orden: number }[];
  /** Tiene pedidos: no se puede eliminar, solo desactivar. */
  hasOrders: boolean;
}

export async function getProductForEdit(id: string): Promise<AdminProductDetail | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("products")
    .select("id, category_id, nombre, slug, descripcion, precio, stock, stock_reservado, sku, activo, destacado")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;

  const [{ data: images }, { count }] = await Promise.all([
    supabase.from("product_images").select("id, url, orden, created_at").eq("product_id", id).order("orden").order("created_at"),
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);

  return {
    id: p.id,
    categoryId: p.category_id,
    nombre: p.nombre,
    slug: p.slug,
    descripcion: p.descripcion,
    precio: Number(p.precio),
    stock: p.stock,
    stockReservado: p.stock_reservado,
    sku: p.sku,
    activo: p.activo,
    destacado: p.destacado,
    images: (images ?? []).map((i) => ({ id: i.id, path: i.url, url: publicImageUrl(i.url), orden: i.orden })),
    hasOrders: (count ?? 0) > 0,
  };
}

export interface TemplateRow {
  id: string;
  category_id: string;
  nombre: string;
  descripcion_base: string;
  precio_sugerido: number | null;
  prefijo_sku: string | null;
}

/** Plantillas de productos comunes (las lee solo el admin por RLS). */
export async function listTemplates(): Promise<TemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_templates")
    .select("id, category_id, nombre, descripcion_base, precio_sugerido, prefijo_sku")
    .order("nombre")
    .returns<TemplateRow[]>();
  return (data ?? []).map((t) => ({ ...t, precio_sugerido: t.precio_sugerido === null ? null : Number(t.precio_sugerido) }));
}
