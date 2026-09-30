"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/account";
import { discountFormSchema, discountIdSchema } from "@/lib/validation/admin-discounts";

export interface DiscountFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const GENERIC_ERROR = "No pudimos guardar el descuento. Inténtalo de nuevo.";
const FIELDS = ["nombre", "tipo", "valor", "alcance", "targetId", "inicia", "termina", "activo"] as const;

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** La base de datos vuelve a validar todo (destino existente, porcentaje < 100, fechas) y aquí se explica. */
function dbError(error: { code?: string; message: string }): DiscountFormState {
  if (error.message.includes("destino_invalido")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { targetId: "Ese producto o categoría ya no existe." } };
  }
  if (error.message.includes("discounts_porcentaje_valido")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { valor: "Un porcentaje debe ser menor que 100." } };
  }
  if (error.message.includes("discounts_fechas_validas")) {
    return { error: "Revisa los datos marcados.", fieldErrors: { termina: "El fin debe ser posterior al inicio." } };
  }
  return { error: GENERIC_ERROR };
}

/**
 * Los precios de la tienda dependen de los descuentos: todo cambio invalida el catálogo y los listados.
 * El precio final NUNCA se guarda ni se recibe: solo el tipo y el valor de la rebaja; la tienda y el
 * checkout lo calculan en el servidor con `priceProduct`.
 */
function invalidate() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin", "layout");
}

function parseForm(formData: FormData) {
  return discountFormSchema.safeParse(Object.fromEntries(FIELDS.map((f) => [f, str(formData, f)])));
}

export async function crearDescuento(_prev: DiscountFormState, formData: FormData): Promise<DiscountFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: "Revisa los datos marcados.", fieldErrors: fieldErrors(parsed.error) };
  const { inicia, ...rest } = parsed.data;

  const supabase = await createClient();
  // Sin fecha de inicio, el descuento empieza ahora (valor por defecto de la base de datos).
  const row: Record<string, unknown> = inicia ? { ...rest, inicia } : { ...rest };
  const { error } = await supabase.from("discounts").insert(row);
  if (error) return dbError(error);

  invalidate();
  redirect("/admin/descuentos");
}

export async function editarDescuento(_prev: DiscountFormState, formData: FormData): Promise<DiscountFormState> {
  await requireAdmin();
  const id = discountIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return { error: "No encontramos ese descuento." };
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: "Revisa los datos marcados.", fieldErrors: fieldErrors(parsed.error) };
  const { inicia, ...rest } = parsed.data;

  const supabase = await createClient();
  // Si se deja vacío el inicio al editar, se conserva el que ya tenía.
  const change: Record<string, unknown> = inicia ? { ...rest, inicia } : { ...rest };
  const { error } = await supabase.from("discounts").update(change).eq("id", id.data.id);
  if (error) return dbError(error);

  invalidate();
  redirect("/admin/descuentos");
}

/** Activar o desactivar desde la lista. */
export async function alternarDescuento(_prev: DiscountFormState, formData: FormData): Promise<DiscountFormState> {
  await requireAdmin();
  const id = discountIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return { error: "No encontramos ese descuento." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("discounts").select("activo").eq("id", id.data.id).maybeSingle();
  if (!current) return { error: "No encontramos ese descuento." };
  const { error } = await supabase.from("discounts").update({ activo: !current.activo }).eq("id", id.data.id);
  if (error) return { error: GENERIC_ERROR };

  invalidate();
  return {};
}

export async function eliminarDescuento(_prev: DiscountFormState, formData: FormData): Promise<DiscountFormState> {
  await requireAdmin();
  const id = discountIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return { error: "No encontramos ese descuento." };

  const supabase = await createClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id.data.id);
  if (error) return { error: GENERIC_ERROR };

  invalidate();
  redirect("/admin/descuentos");
}
