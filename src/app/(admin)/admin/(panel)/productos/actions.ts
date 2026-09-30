"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/catalog";
import { MAX_PRODUCT_IMAGES, removeImages, storeImage } from "@/lib/product-images";
import { nextAvailableSlug, slugify } from "@/lib/slug";
import { checkStockChange } from "@/lib/stock-rules";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/account";
import { imageActionSchema, productFormSchema, productIdSchema } from "@/lib/validation/admin-products";
import { uuid } from "@/lib/validation/common";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ProductActionState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

export type CreateProductResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type UploadResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "No pudimos guardar el cambio. Inténtalo de nuevo.";

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function dbMessage(error: { code?: string; message: string }): string {
  if (error.code === "23505" && error.message.includes("sku")) return "Ya existe un producto con ese SKU.";
  if (error.message.includes("products_reserva_valida")) {
    return "No puedes dejar menos unidades de las que están reservadas por pedidos que aún no se cierran.";
  }
  return GENERIC_ERROR;
}

/** Cualquier cambio de productos o de sus imágenes invalida el catálogo público. */
function invalidateCatalog() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin", "layout"); // listados, contadores y detalle del dashboard
}

/** El producto va siempre en una subcategoría (categoría de segundo nivel). */
async function isSubcategory(supabase: Supabase, id: string) {
  const { data } = await supabase.from("categories").select("id, parent_id").eq("id", id).maybeSingle();
  return Boolean(data && data.parent_id !== null);
}

async function takenSlugs(supabase: Supabase, base: string) {
  const { data } = await supabase.from("products").select("slug").like("slug", `${base}%`).limit(1000);
  return new Set((data ?? []).map((r) => r.slug as string));
}

// ---------------------------------------------------------------------------
// Alta (la llama el asistente de 4 pasos)
// ---------------------------------------------------------------------------

export async function crearProducto(input: unknown): Promise<CreateProductResult> {
  await requireAdmin();
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos marcados.", fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;

  const supabase = await createClient();
  if (!(await isSubcategory(supabase, p.categoryId))) {
    return { ok: false, error: "Elige una subcategoría.", fieldErrors: { categoryId: "Elige una subcategoría." } };
  }

  // Slug automático y único; si dos personas crean a la vez, se reintenta una vez.
  const base = slugify(p.nombre, "producto");
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = nextAvailableSlug(base, await takenSlugs(supabase, base));
    const { data, error } = await supabase
      .from("products")
      .insert({
        category_id: p.categoryId,
        nombre: p.nombre,
        slug,
        descripcion: p.descripcion,
        precio: p.precio,
        stock: p.stock,
        sku: p.sku,
        activo: p.activo,
        destacado: p.destacado,
      })
      .select("id")
      .single();
    if (!error && data) {
      invalidateCatalog();
      return { ok: true, id: data.id };
    }
    const slugClash = error?.code === "23505" && !error.message.includes("sku");
    if (!slugClash || attempt === 1) {
      return { ok: false, error: error ? dbMessage(error) : GENERIC_ERROR, fieldErrors: error?.message.includes("sku") ? { sku: "Ya existe un producto con ese SKU." } : undefined };
    }
  }
  return { ok: false, error: GENERIC_ERROR };
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

export async function editarProducto(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  await requireAdmin();
  const id = productIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return { error: "No encontramos ese producto." };
  const parsed = productFormSchema.safeParse({
    categoryId: str(formData, "categoryId"),
    nombre: str(formData, "nombre"),
    descripcion: str(formData, "descripcion"),
    precio: str(formData, "precio"),
    stock: str(formData, "stock"),
    sku: str(formData, "sku"),
    activo: str(formData, "activo"),
    destacado: str(formData, "destacado"),
  });
  if (!parsed.success) return { error: "Revisa los datos marcados.", fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;

  const supabase = await createClient();
  if (!(await isSubcategory(supabase, p.categoryId))) {
    return { error: "Revisa los datos marcados.", fieldErrors: { categoryId: "Elige una subcategoría." } };
  }

  // El stock no puede quedar por debajo de lo reservado. La base de datos también lo impide
  // (products_reserva_valida), pero aquí se explica con el número real.
  const { data: current } = await supabase.from("products").select("stock_reservado").eq("id", id.data.id).maybeSingle();
  if (!current) return { error: "No encontramos ese producto." };
  const stock = checkStockChange(p.stock, current.stock_reservado);
  if (!stock.ok) return { error: "Revisa los datos marcados.", fieldErrors: { stock: stock.error } };

  // El slug no cambia al editar: los enlaces y el posicionamiento siguen igual.
  const { error } = await supabase
    .from("products")
    .update({
      category_id: p.categoryId,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      stock: p.stock,
      sku: p.sku,
      activo: p.activo,
      destacado: p.destacado,
    })
    .eq("id", id.data.id);
  if (error) {
    return {
      error: dbMessage(error),
      fieldErrors: error.message.includes("sku")
        ? { sku: "Ya existe un producto con ese SKU." }
        : error.message.includes("products_reserva_valida")
          ? { stock: "Mientras editabas, se reservaron más unidades. Actualiza la página para ver cuántas." }
          : undefined,
    };
  }

  invalidateCatalog();
  return { ok: "Cambios guardados." };
}

/** Activar/desactivar y destacado desde el listado. */
export async function alternarProducto(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  await requireAdmin();
  const parsed = z.object({ id: uuid, campo: z.enum(["activo", "destacado"]) }).safeParse({
    id: str(formData, "id"),
    campo: str(formData, "campo"),
  });
  if (!parsed.success) return { error: "Acción no válida." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("products").select("activo, destacado").eq("id", parsed.data.id).maybeSingle();
  if (!current) return { error: "No encontramos ese producto." };
  const { error } = await supabase
    .from("products")
    .update({ [parsed.data.campo]: !current[parsed.data.campo] })
    .eq("id", parsed.data.id);
  if (error) return { error: GENERIC_ERROR };

  invalidateCatalog();
  return {};
}

export async function eliminarProducto(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  await requireAdmin();
  const id = productIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return { error: "No encontramos ese producto." };

  const supabase = await createClient();
  // Un producto con pedidos no se elimina (los pedidos guardan su historial): se desactiva.
  const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id.data.id);
  if ((count ?? 0) > 0) {
    return { error: "Este producto tiene pedidos, así que no se puede eliminar. Desactívalo para ocultarlo de la tienda." };
  }

  const { data: images } = await supabase.from("product_images").select("url").eq("product_id", id.data.id);
  const { error } = await supabase.from("products").delete().eq("id", id.data.id);
  if (error) return { error: GENERIC_ERROR };

  await removeImages(supabase, (images ?? []).map((i) => i.url as string));
  invalidateCatalog();
  redirect("/admin/productos");
}

// ---------------------------------------------------------------------------
// Imágenes del producto
// ---------------------------------------------------------------------------

/** Sube UNA imagen (una petición por archivo, para no pasar del límite de 4 MB de Vercel). */
export async function subirImagenProducto(productId: unknown, formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const id = uuid.safeParse(productId);
  const file = formData.get("archivo");
  if (!id.success || !(file instanceof File)) return { ok: false, error: "Elige una imagen." };

  const supabase = await createClient();
  const { data: images } = await supabase.from("product_images").select("orden").eq("product_id", id.data);
  if ((images?.length ?? 0) >= MAX_PRODUCT_IMAGES) {
    return { ok: false, error: `Máximo ${MAX_PRODUCT_IMAGES} imágenes por producto.` };
  }

  const stored = await storeImage(supabase, `productos/${id.data}`, file);
  if (!stored.ok) return stored;

  const orden = (images ?? []).reduce((max, i) => Math.max(max, i.orden), -1) + 1;
  const { error } = await supabase.from("product_images").insert({ product_id: id.data, url: stored.path, orden });
  if (error) {
    await removeImages(supabase, [stored.path]); // sin archivo huérfano
    return { ok: false, error: GENERIC_ERROR };
  }
  invalidateCatalog();
  return { ok: true };
}

/** Quitar, hacer portada o mover una imagen. La portada es la primera. */
export async function accionImagen(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  await requireAdmin();
  const parsed = imageActionSchema.safeParse({
    productId: str(formData, "productId"),
    imageId: str(formData, "imageId"),
    intent: str(formData, "intent"),
  });
  if (!parsed.success) return { error: "Acción no válida." };
  const { productId, imageId, intent } = parsed.data;
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("product_images")
    .select("id, url")
    .eq("product_id", productId)
    .order("orden")
    .order("created_at");
  const list = images ?? [];
  const index = list.findIndex((i) => i.id === imageId);
  if (index < 0) return { error: "No encontramos esa imagen." };

  if (intent === "quitar") {
    const { error } = await supabase.from("product_images").delete().eq("id", imageId);
    if (error) return { error: GENERIC_ERROR };
    await removeImages(supabase, [list[index].url as string]);
    list.splice(index, 1);
  } else {
    const [moved] = list.splice(index, 1);
    const target = intent === "portada" ? 0 : intent === "arriba" ? Math.max(index - 1, 0) : Math.min(index + 1, list.length);
    list.splice(target, 0, moved);
  }

  // Se renumera de 0 a n-1 (son pocas imágenes: máximo 8).
  for (const [orden, image] of list.entries()) {
    await supabase.from("product_images").update({ orden }).eq("id", image.id);
  }
  invalidateCatalog();
  return {};
}

// ---------------------------------------------------------------------------
// Imagen de una categoría (opcional)
// ---------------------------------------------------------------------------

export async function subirImagenCategoria(categoryId: unknown, formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const id = uuid.safeParse(categoryId);
  const file = formData.get("archivo");
  if (!id.success || !(file instanceof File)) return { ok: false, error: "Elige una imagen." };

  const supabase = await createClient();
  const { data: category } = await supabase.from("categories").select("imagen_url").eq("id", id.data).maybeSingle();
  if (!category) return { ok: false, error: "No encontramos esa categoría." };

  const stored = await storeImage(supabase, `categorias/${id.data}`, file);
  if (!stored.ok) return stored;

  const { error } = await supabase.from("categories").update({ imagen_url: stored.path }).eq("id", id.data);
  if (error) {
    await removeImages(supabase, [stored.path]);
    return { ok: false, error: GENERIC_ERROR };
  }
  // La imagen anterior ya no se usa.
  if (category.imagen_url) await removeImages(supabase, [category.imagen_url as string]);
  invalidateCatalog();
  return { ok: true };
}

export async function quitarImagenCategoria(_prev: ProductActionState, formData: FormData): Promise<ProductActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(formData, "id"));
  if (!id.success) return { error: "No encontramos esa categoría." };

  const supabase = await createClient();
  const { data: category } = await supabase.from("categories").select("imagen_url").eq("id", id.data).maybeSingle();
  if (!category) return { error: "No encontramos esa categoría." };

  const { error } = await supabase.from("categories").update({ imagen_url: null }).eq("id", id.data);
  if (error) return { error: GENERIC_ERROR };
  if (category.imagen_url) await removeImages(supabase, [category.imagen_url as string]);
  invalidateCatalog();
  return {};
}
