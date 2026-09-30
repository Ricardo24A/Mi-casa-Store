import "server-only";
import { getAdminCategoryTree } from "@/lib/admin-categories";
import { discountStatus, type DiscountKind, type DiscountScope, type DiscountStatus } from "@/lib/discount-rules";
import type { OtherDiscount } from "@/lib/discount-preview";
import { createClient } from "@/lib/supabase/server";

interface Row {
  id: string;
  nombre: string;
  tipo: DiscountKind;
  valor: number;
  alcance: DiscountScope;
  target_id: string | null;
  codigo: string | null;
  inicia: string;
  termina: string | null;
  activo: boolean;
}

const COLUMNS = "id, nombre, tipo, valor, alcance, target_id, codigo, inicia, termina, activo";

export interface AdminDiscount extends Row {
  status: DiscountStatus;
  /** Nombre del producto o de la categoría a la que apunta. */
  targetName: string | null;
}

/** Nombres de productos y categorías por id (para mostrar a qué se aplica cada descuento). */
async function targetNames(rows: Row[]) {
  const supabase = await createClient();
  const productIds = [...new Set(rows.filter((r) => r.alcance === "producto" && r.target_id).map((r) => r.target_id as string))];
  const tree = await getAdminCategoryTree();
  const categories = new Map<string, string>();
  for (const root of tree) {
    categories.set(root.id, root.nombre);
    for (const sub of root.hijas) categories.set(sub.id, `${root.nombre} › ${sub.nombre}`);
  }
  const products = new Map<string, string>();
  if (productIds.length > 0) {
    const { data } = await supabase.from("products").select("id, nombre").in("id", productIds);
    for (const p of data ?? []) products.set(p.id as string, p.nombre as string);
  }
  return { products, categories, tree };
}

/** Todos los descuentos, del más reciente al más antiguo. Solo tras `requireAdmin()` (RLS: admin con 2FA). */
export async function listDiscounts(now: Date): Promise<AdminDiscount[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("discounts").select(COLUMNS).order("created_at", { ascending: false }).returns<Row[]>();
  const rows = (data ?? []).map((r) => ({ ...r, valor: Number(r.valor) }));
  const { products, categories } = await targetNames(rows);
  return rows.map((r) => ({
    ...r,
    status: discountStatus(r, now),
    targetName: r.target_id ? ((r.alcance === "producto" ? products.get(r.target_id) : categories.get(r.target_id)) ?? null) : null,
  }));
}

export async function getDiscount(id: string): Promise<Row | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("discounts").select(COLUMNS).eq("id", id).maybeSingle<Row>();
  return data ? { ...data, valor: Number(data.valor) } : null;
}

export interface DiscountFormContext {
  products: { id: string; nombre: string; precio: number; category_id: string }[];
  /** Categorías y subcategorías que se pueden elegir como destino. */
  categories: { id: string; label: string }[];
  /** subcategoría -> categoría padre (para que un descuento por categoría alcance a sus subcategorías). */
  parents: Record<string, string | null>;
  /** Los demás descuentos, para mostrar en la vista previa cuál gana. */
  others: OtherDiscount[];
  transferPct: number;
}

/** Datos para el formulario y su vista previa. `excludeId`: el descuento que se está editando. */
export async function getDiscountFormContext(excludeId?: string): Promise<DiscountFormContext> {
  const supabase = await createClient();
  const [{ data: products }, { data: discounts }, { data: settings }, tree] = await Promise.all([
    supabase.from("products").select("id, nombre, precio, category_id").order("nombre").limit(3000),
    supabase.from("discounts").select(COLUMNS).returns<Row[]>(),
    supabase.from("store_settings").select("descuento_transferencia_pct").maybeSingle(),
    getAdminCategoryTree(),
  ]);

  const parents: Record<string, string | null> = {};
  const categories: { id: string; label: string }[] = [];
  for (const root of tree) {
    parents[root.id] = null;
    categories.push({ id: root.id, label: `${root.nombre} (toda la categoría)` });
    for (const sub of root.hijas) {
      parents[sub.id] = root.id;
      categories.push({ id: sub.id, label: `${root.nombre} › ${sub.nombre}` });
    }
  }

  return {
    products: (products ?? []).map((p) => ({ id: p.id as string, nombre: p.nombre as string, precio: Number(p.precio), category_id: p.category_id as string })),
    categories,
    parents,
    others: (discounts ?? [])
      .filter((d) => d.id !== excludeId)
      .map((d) => ({ ...d, valor: Number(d.valor) })),
    transferPct: Number(settings?.descuento_transferencia_pct ?? 0),
  };
}
