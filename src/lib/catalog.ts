import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient, publicImageUrl } from "@/lib/supabase/public";
import { priceProduct, type PricingDiscount } from "@/lib/pricing";
import { escapeLike } from "@/lib/validation/catalog-query";
import type {
  CategoryNode,
  CategoryScope,
  StoreProduct,
  SubcategoryNode,
} from "@/types/store";

/**
 * Lectura del catálogo público. Todo pasa por el cliente anónimo (RLS): solo se ve lo activo y
 * lo visible (vista `visible_categories`, CLAUDE.md sección 4).
 *
 * Las funciones con `'use cache'` llevan la etiqueta `catalogo`. Cuando el dashboard cree,
 * active, desactive o elimine un producto, debe invalidarla (`updateTag`/`revalidateTag`).
 * Además caducan solas cada pocos minutos (los descuentos tienen fechas).
 */
export const CATALOG_TAG = "catalogo";

const MAX_PRODUCTS = 500;

interface CategoryRow {
  id: string;
  parent_id: string | null;
  nombre: string;
  slug: string;
  imagen_url: string | null;
}

interface ProductRow {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  stock_reservado: number;
  category_id: string;
  destacado: boolean;
  created_at: string;
  product_images: { url: string; orden: number }[] | null;
}

const PRODUCT_COLUMNS =
  "id, slug, nombre, descripcion, precio, stock, stock_reservado, category_id, destacado, created_at, product_images(url, orden)";

type CategoryIndex = Map<string, CategoryRow>;

// ---------------------------------------------------------------------------
// Lecturas sin caché (base de las versiones cacheadas y del carrito, que necesita datos frescos)
// ---------------------------------------------------------------------------

async function fetchVisibleCategoryRows(): Promise<CategoryRow[]> {
  const { data, error } = await createPublicClient()
    .from("visible_categories")
    .select("id, parent_id, nombre, slug, imagen_url, orden")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return data as CategoryRow[];
}

async function fetchAllCategoryRows(): Promise<CategoryRow[]> {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, parent_id, nombre, slug, imagen_url");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return data as CategoryRow[];
}

async function fetchDiscounts(): Promise<PricingDiscount[]> {
  // RLS deja pasar solo los descuentos automáticos (sin cupón), activos y vigentes.
  const { data, error } = await createPublicClient()
    .from("discounts")
    .select("id, tipo, valor, alcance, target_id, codigo, inicia, termina, activo");
  if (error) throw new Error(`No se pudieron leer los descuentos: ${error.message}`);
  return data as PricingDiscount[];
}

function indexOf(rows: CategoryRow[]): CategoryIndex {
  return new Map(rows.map((r) => [r.id, r]));
}

function toStoreProduct(
  row: ProductRow,
  index: CategoryIndex,
  discounts: PricingDiscount[],
  now: Date,
): StoreProduct | null {
  const sub = index.get(row.category_id);
  const cat = sub?.parent_id ? index.get(sub.parent_id) : undefined;
  if (!sub || !cat) return null;

  const parents: Record<string, string | null> = {};
  for (const c of index.values()) parents[c.id] = c.parent_id;

  const price = priceProduct(
    { id: row.id, category_id: row.category_id, precio: Number(row.precio) },
    discounts,
    { now, parents },
  );

  return {
    id: row.id,
    slug: row.slug,
    nombre: row.nombre,
    descripcion: row.descripcion,
    categoria: { slug: cat.slug, nombre: cat.nombre },
    subcategoria: { slug: sub.slug, nombre: sub.nombre },
    precio: price.precioLista,
    precioFinal: price.precioFinal,
    descuentoPct:
      price.descuento > 0 ? Math.round((price.descuento / price.precioLista) * 100) : null,
    disponible: Math.max(row.stock - row.stock_reservado, 0),
    destacado: row.destacado,
    imagenes: (row.product_images ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((img) => publicImageUrl(img.url)),
    createdAt: row.created_at,
  };
}

function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const subsByParent = new Map<string, SubcategoryNode[]>();
  for (const r of rows) {
    if (!r.parent_id) continue;
    const list = subsByParent.get(r.parent_id) ?? [];
    list.push({ id: r.id, slug: r.slug, nombre: r.nombre, parentId: r.parent_id });
    subsByParent.set(r.parent_id, list);
  }
  return rows
    .filter((r) => r.parent_id === null)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      nombre: r.nombre,
      imagenUrl: r.imagen_url ? publicImageUrl(r.imagen_url) : null,
      subcategorias: subsByParent.get(r.id) ?? [],
    }))
    .filter((c) => c.subcategorias.length > 0);
}

// ---------------------------------------------------------------------------
// Lecturas cacheadas (catálogo público)
// ---------------------------------------------------------------------------

/** Categorías visibles con sus subcategorías visibles. Vacío si no hay productos activos. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return buildTree(await fetchVisibleCategoryRows());
}

/** Resuelve un slug de categoría o subcategoría visible. Null si no existe o está vacía (404). */
export async function getCategoryScope(slug: string): Promise<CategoryScope | null> {
  const tree = await getCategoryTree();
  for (const categoria of tree) {
    if (categoria.slug === slug) return { tipo: "categoria", categoria };
    const subcategoria = categoria.subcategorias.find((s) => s.slug === slug);
    if (subcategoria) return { tipo: "subcategoria", categoria, subcategoria };
  }
  return null;
}

export interface CatalogFilter {
  /** Slug de una categoría o subcategoría visible. Sin él, todo el catálogo. */
  scopeSlug?: string;
  /** Texto de búsqueda ya saneado (ver `sanitizeSearch`). */
  q?: string;
}

/**
 * Productos activos de categorías visibles, con precio final. Sin ordenar por precio ni
 * paginar: eso lo hace la página sobre este resultado (el orden por precio debe usar el
 * precio con descuento).
 */
export async function getCatalogProducts(filter: CatalogFilter): Promise<StoreProduct[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const tree = await getCategoryTree();
  let categoryIds: string[];
  if (filter.scopeSlug) {
    const scope = await getCategoryScope(filter.scopeSlug);
    if (!scope) return [];
    categoryIds =
      scope.tipo === "subcategoria"
        ? [scope.subcategoria.id]
        : scope.categoria.subcategorias.map((s) => s.id);
  } else {
    categoryIds = tree.flatMap((c) => c.subcategorias.map((s) => s.id));
  }
  if (categoryIds.length === 0) return [];

  let query = createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("activo", true)
    .in("category_id", categoryIds);

  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`;
    query = query.or(`nombre.ilike.${pattern},descripcion.ilike.${pattern}`);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(MAX_PRODUCTS);
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);

  const [rows, discounts] = await Promise.all([fetchVisibleCategoryRows(), fetchDiscounts()]);
  const index = indexOf(rows);
  const now = new Date();
  return (data as unknown as ProductRow[])
    .map((row) => toStoreProduct(row, index, discounts, now))
    .filter((p): p is StoreProduct => p !== null);
}

/** Un producto activo por su slug, o null (404). */
export async function getProductBySlug(slug: string): Promise<StoreProduct | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("activo", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el producto: ${error.message}`);
  if (!data) return null;

  const [rows, discounts] = await Promise.all([fetchVisibleCategoryRows(), fetchDiscounts()]);
  return toStoreProduct(data as unknown as ProductRow, indexOf(rows), discounts, new Date());
}

/** Para el sitemap: slugs de productos visibles. */
export async function getProductSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const products = await getCatalogProducts({});
  return products.map((p) => ({ slug: p.slug, updatedAt: p.createdAt }));
}

// ---------------------------------------------------------------------------
// Sin caché: el carrito necesita precio y stock del momento
// ---------------------------------------------------------------------------

/** Productos por ID con precio y stock actuales (sin caché). Los inactivos no se devuelven. */
export async function getProductsByIds(ids: string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) return [];
  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("activo", true)
    .in("id", ids);
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);

  const [rows, discounts] = await Promise.all([fetchAllCategoryRows(), fetchDiscounts()]);
  const index = indexOf(rows);
  const now = new Date();
  return (data as unknown as ProductRow[])
    .map((row) => toStoreProduct(row, index, discounts, now))
    .filter((p): p is StoreProduct => p !== null);
}
