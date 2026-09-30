"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/catalog";
import { nextAvailableSlug, slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/account";
import { categoryFormSchema, categoryIdSchema, categoryRowActionSchema } from "@/lib/validation/admin-categories";

export interface CategoryFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

const GENERIC_ERROR = "No pudimos guardar el cambio. Inténtalo de nuevo.";

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Errores de la base de datos en lenguaje claro. */
function dbMessage(error: { code?: string; message: string }): string {
  if (error.message.includes("solo_dos_niveles")) {
    return "Solo hay dos niveles: categoría y subcategoría. Una categoría con subcategorías no puede pasar a ser subcategoría.";
  }
  if (error.code === "23505" && error.message.includes("categories_unique_name")) {
    return "Ya existe una categoría con ese nombre en ese lugar.";
  }
  if (error.code === "23503") {
    return "No se puede eliminar: tiene productos o subcategorías. Muévelos, o desactiva la categoría para ocultarla de la tienda.";
  }
  return GENERIC_ERROR;
}

/** Cualquier cambio de categorías o de su visibilidad invalida el catálogo público. */
function invalidateCatalog() {
  updateTag(CATALOG_TAG);
}

async function takenSlugs(supabase: Awaited<ReturnType<typeof createClient>>, base: string) {
  const { data } = await supabase.from("categories").select("slug").like("slug", `${base}%`).limit(1000);
  return new Set((data ?? []).map((r) => r.slug as string));
}

export async function crearCategoria(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();
  const values = { nombre: str(formData, "nombre").slice(0, 80), parentId: str(formData, "parentId") };
  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { nombre, parentId } = parsed.data;

  if (parentId) {
    const { data: parent } = await supabase.from("categories").select("id, parent_id").eq("id", parentId).maybeSingle();
    if (!parent || parent.parent_id !== null) {
      return { fieldErrors: { parentId: "Elige una categoría de primer nivel." }, values };
    }
  }

  // Al final de sus hermanas.
  const siblings = supabase.from("categories").select("orden").order("orden", { ascending: false }).limit(1);
  const { data: last } = await (parentId ? siblings.eq("parent_id", parentId) : siblings.is("parent_id", null));
  const orden = (last?.[0]?.orden ?? -1) + 1;

  // Slug automático y único en toda la tabla. Si dos personas crean a la vez, se reintenta una vez.
  const base = slugify(nombre, "categoria");
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = nextAvailableSlug(base, await takenSlugs(supabase, base));
    const { error } = await supabase
      .from("categories")
      .insert({ nombre, slug, parent_id: parentId, orden });
    if (!error) {
      invalidateCatalog();
      redirect("/admin/categorias");
    }
    const isSlugClash = error.code === "23505" && !error.message.includes("categories_unique_name");
    if (!isSlugClash || attempt === 1) return { error: dbMessage(error), values };
  }
  return { error: GENERIC_ERROR, values };
}

export async function editarCategoria(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();
  const id = categoryIdSchema.safeParse({ id: str(formData, "id") });
  const values = { nombre: str(formData, "nombre").slice(0, 80), parentId: str(formData, "parentId") };
  const parsed = categoryFormSchema.safeParse(values);
  if (!id.success) return { error: "No encontramos esa categoría.", values };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { nombre, parentId } = parsed.data;
  if (parentId === id.data.id) return { fieldErrors: { parentId: "No puede ser su propia categoría." }, values };

  const { data: current } = await supabase.from("categories").select("parent_id").eq("id", id.data.id).maybeSingle();
  if (!current) return { error: "No encontramos esa categoría.", values };

  // El slug no cambia al renombrar: los enlaces existentes siguen funcionando.
  const change: { nombre: string; parent_id?: string | null; orden?: number } = { nombre };
  if (parentId !== current.parent_id) {
    // Cambiar de lugar la manda al final de su nueva lista.
    const siblings = supabase.from("categories").select("orden").order("orden", { ascending: false }).limit(1);
    const { data: last } = await (parentId ? siblings.eq("parent_id", parentId) : siblings.is("parent_id", null));
    change.parent_id = parentId;
    change.orden = (last?.[0]?.orden ?? -1) + 1;
  }
  const { error } = await supabase.from("categories").update(change).eq("id", id.data.id);
  if (error) return { error: dbMessage(error), values };

  invalidateCatalog();
  redirect("/admin/categorias");
}

/** Activar/desactivar y subir/bajar desde la lista. */
export async function accionCategoria(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();
  const parsed = categoryRowActionSchema.safeParse({ id: str(formData, "id"), intent: str(formData, "intent") });
  if (!parsed.success) return { error: "Acción no válida." };
  const { id, intent } = parsed.data;
  const supabase = await createClient();

  if (intent === "alternar") {
    const { data: current } = await supabase.from("categories").select("activa").eq("id", id).maybeSingle();
    if (!current) return { error: "No encontramos esa categoría." };
    const { error } = await supabase.from("categories").update({ activa: !current.activa }).eq("id", id);
    if (error) return { error: dbMessage(error) };
  } else {
    const { error } = await supabase.rpc("admin_move_category", { p_id: id, p_direction: intent });
    if (error) return { error: GENERIC_ERROR };
  }

  invalidateCatalog();
  return {};
}

export async function eliminarCategoria(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();
  const id = categoryIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return { error: "No encontramos esa categoría." };

  // Las claves foráneas impiden borrar una categoría con subcategorías o con productos.
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id.data.id);
  if (error) return { error: dbMessage(error) };

  invalidateCatalog();
  redirect("/admin/categorias");
}
