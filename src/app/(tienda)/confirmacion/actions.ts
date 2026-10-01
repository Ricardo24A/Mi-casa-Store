"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { checkRateLimits } from "@/lib/rate-limit";
import { rateLimitMessage } from "@/lib/rate-limit-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PROOF_MAX_BYTES, checkProofBytes } from "@/lib/validation/files";

export type ProofResult =
  | { ok: true; reemplazo: boolean }
  | { ok: false; error: string; code?: "login" };

const referenciaSchema = z.string().regex(/^MC-[A-Z2-9]{8}$/);
const BUCKET = "payment-proofs";
const GENERIC_ERROR = "No pudimos guardar tu comprobante. Inténtalo de nuevo en un momento.";

/** Errores de `submit_payment_proof` que el comprador puede ver, con un mensaje claro. */
const DB_ERRORS: Record<string, string> = {
  pedido_vencido: "El plazo de este pedido ya venció, así que ya no se puede subir ni cambiar el comprobante.",
  limite_comprobantes: "Ya subiste 3 comprobantes para este pedido, que es el máximo.",
  mismo_archivo: "Ese es el mismo archivo que ya subiste. Elige otro.",
  comprobante_aprobado: "Tu comprobante ya fue aprobado y no se puede cambiar.",
  estado_invalido: "Este pedido ya no admite cambios de comprobante.",
  pedido_no_encontrado: "No encontramos ese pedido.",
};

/**
 * Sube el comprobante de un pedido (bucket privado `payment-proofs`), o lo REEMPLAZA mientras
 * siga en revisión.
 *  - Solo el dueño del pedido, con sesión de cliente.
 *  - El tipo REAL se valida aquí por los primeros bytes (no por el nombre ni por lo que declara el
 *    navegador): solo JPG, PNG o PDF, máximo 4 MB. El archivo nunca se sirve al comprador.
 *  - El nombre en el bucket lo genera el servidor.
 *  - Guardar (o reemplazar) el comprobante y cambiar el estado del pedido es una sola transacción
 *    en la base de datos (`submit_payment_proof`), con el pedido bloqueado: verifica el estado
 *    anterior, el plazo (que no se reinicia), el tope de 3 comprobantes y que uno aprobado no se
 *    toque. Si sale bien, el archivo reemplazado se borra del bucket; si la base rechaza, se borra el nuevo.
 */
export async function subirComprobante(referencia: unknown, formData: FormData): Promise<ProofResult> {
  const session = await getAdminSession();
  if (!session.userId || session.role !== "customer") {
    return { ok: false, code: "login", error: "Inicia sesión para subir tu comprobante." };
  }

  const ref = referenciaSchema.safeParse(referencia);
  const file = formData.get("archivo");
  if (!ref.success || !(file instanceof File)) return { ok: false, error: "Elige el archivo de tu comprobante." };
  // Por usuario. Falla abierto: la base ya limita a 3 comprobantes por pedido, y bloquear aquí dejaría
  // a un cliente sin poder pagar si la función de límite fallara.
  const limited = rateLimitMessage(await checkRateLimits([{ rule: "comprobante", identity: session.userId }], "open"));
  if (limited) return { ok: false, error: limited };

  // Primero el pedido: existe, es de este usuario y admite comprobante. Solo entonces se lee el archivo
  // en memoria. RLS: solo el dueño ve su pedido; el filtro por user_id es una segunda barrera.
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, estado")
    .eq("referencia", ref.data)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!order) return { ok: false, error: "No encontramos ese pedido." };
  // La base de datos decide el detalle; esto solo evita leer y subir un archivo que seguro no se usará.
  if (order.estado !== "pendiente_pago" && order.estado !== "comprobante_recibido") {
    return { ok: false, error: "Este pedido ya no admite cambios de comprobante." };
  }

  // El tamaño, antes de leerlo en memoria; después, el tipo real por los primeros bytes.
  if (file.size > PROOF_MAX_BYTES) return { ok: false, error: "El archivo pesa más de 4 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkProofBytes(bytes);
  if (!check.ok) return { ok: false, error: check.error };

  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = `${session.userId}/${order.id}/${randomUUID()}.${check.extension}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: check.mime, upsert: false });
  if (uploadError) return { ok: false, error: GENERIC_ERROR };

  // La función también calcula si el mismo archivo (hash) ya está en OTRO pedido. Eso es solo para el
  // dueño: al revisar el comprobante se consulta por el hash. Aquí no se devuelve nada de eso.
  const { data, error } = await admin.rpc("submit_payment_proof", {
    p_user_id: session.userId,
    p_order_id: order.id,
    p_archivo: path,
    p_hash: hash,
  });
  if (error) {
    // La base rechazó el comprobante: no se deja el archivo huérfano en el bucket.
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  }

  // Reemplazo exitoso: el archivo anterior ya no sirve. Si falla el borrado no se avisa al comprador
  // (el comprobante nuevo ya quedó bien); el archivo suelto solo ocupa espacio.
  const row = Array.isArray(data) ? data[0] : data;
  const anterior: string | null = row?.o_archivo_anterior ?? null;
  if (anterior) await admin.storage.from(BUCKET).remove([anterior]);

  revalidatePath("/cuenta");
  revalidatePath(`/confirmacion/${ref.data}`);
  return { ok: true, reemplazo: Boolean(anterior) };
}
