"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addressIdSchema,
  addressSchema,
  fieldErrors,
  profileSchema,
} from "@/lib/validation/account";

import type { AccountFormState } from "@/app/(acceso)/actions";

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function cerrarSesionCliente() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Mis datos
// ---------------------------------------------------------------------------

export async function guardarDatos(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const { userId } = await requireCustomer();
  const values = { full_name: str(formData, "full_name").slice(0, 120), phone: str(formData, "phone").slice(0, 20) };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  // Solo se actualizan nombre y teléfono (el permiso de columnas de la base no admite más).
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return { error: "No pudimos guardar tus datos. Inténtalo de nuevo.", values };

  revalidatePath("/cuenta/datos");
  return { ok: "Datos guardados.", values };
}

// ---------------------------------------------------------------------------
// Direcciones de envío
// ---------------------------------------------------------------------------

export async function guardarDireccion(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const { userId } = await requireCustomer();
  const raw = {
    etiqueta: str(formData, "etiqueta").slice(0, 40),
    destinatario: str(formData, "destinatario").slice(0, 120),
    telefono: str(formData, "telefono").slice(0, 20),
    provincia: str(formData, "provincia"),
    ciudad: str(formData, "ciudad").slice(0, 80),
    direccion: str(formData, "direccion").slice(0, 200),
    referencia: str(formData, "referencia").slice(0, 200),
  };
  const parsed = addressSchema.safeParse({ ...raw, es_predeterminada: formData.get("es_predeterminada") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const idRaw = str(formData, "id");

  if (idRaw) {
    const id = addressIdSchema.safeParse({ id: idRaw });
    if (!id.success) return { error: "No encontramos esa dirección.", values: raw };
    // RLS limita la fila a las del propio usuario; si no es suya no se actualiza nada.
    const { data, error } = await supabase
      .from("customer_addresses")
      .update(parsed.data)
      .eq("id", id.data.id)
      .select("id");
    if (error || !data?.length) return { error: "No pudimos guardar la dirección.", values: raw };
  } else {
    const { error } = await supabase.from("customer_addresses").insert({ ...parsed.data, user_id: userId });
    if (error) {
      return {
        error:
          error.code === "23514"
            ? "Ya tienes 10 direcciones guardadas. Elimina una para agregar otra."
            : "No pudimos guardar la dirección.",
        values: raw,
      };
    }
  }

  revalidatePath("/cuenta/direcciones");
  redirect("/cuenta/direcciones");
}

export async function eliminarDireccion(formData: FormData) {
  await requireCustomer();
  const id = addressIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("customer_addresses").delete().eq("id", id.data.id);
  revalidatePath("/cuenta/direcciones");
}

export async function hacerPredeterminada(formData: FormData) {
  await requireCustomer();
  const id = addressIdSchema.safeParse({ id: str(formData, "id") });
  if (!id.success) return;
  const supabase = await createClient();
  // El trigger de la base quita la marca de las demás.
  await supabase.from("customer_addresses").update({ es_predeterminada: true }).eq("id", id.data.id);
  revalidatePath("/cuenta/direcciones");
}
