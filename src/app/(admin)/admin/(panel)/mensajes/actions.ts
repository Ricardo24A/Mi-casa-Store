"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";

export interface MessageActionState {
  error?: string;
  ok?: string;
}

/** Errores de `admin_mark_message_read` y `admin_archive_message`, en lenguaje claro. */
const DB_ERRORS: Record<string, string> = {
  no_autorizado: "Tu sesión no tiene permiso. Vuelve a iniciar sesión con tu código de 2 pasos.",
  mensaje_no_encontrado: "No encontramos el mensaje.",
  estado_invalido: "El mensaje ya cambió de estado. Actualiza la página.",
};
const GENERIC_ERROR = "No pudimos completar el cambio. Inténtalo de nuevo.";

const idField = z.object({ id: uuid });

/**
 * Cambia el estado de un mensaje con su función de base de datos, que comprueba que sea el admin
 * con 2FA, bloquea la fila y verifica el estado anterior (un doble clic falla sin cambiar nada).
 */
async function transition(formData: FormData, fn: "admin_mark_message_read" | "admin_archive_message", ok: string) {
  await requireAdmin();
  const parsed = idField.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "No encontramos el mensaje." };

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_id: parsed.data.id });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  // Refresca el listado, el contador del menú y el Resumen.
  revalidatePath("/admin", "layout");
  return { ok };
}

/** Nuevo -> leído. */
export async function marcarLeido(_prev: MessageActionState, formData: FormData): Promise<MessageActionState> {
  return transition(formData, "admin_mark_message_read", "Mensaje marcado como leído.");
}

/** Nuevo o leído -> archivado. */
export async function archivarMensaje(_prev: MessageActionState, formData: FormData): Promise<MessageActionState> {
  return transition(formData, "admin_archive_message", "Mensaje archivado.");
}
