"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  notifyOrderCancelled,
  notifyOrderShipped,
  notifyPaymentApproved,
  notifyProofRejected,
} from "@/lib/email/notify";
import { createClient } from "@/lib/supabase/server";
import { text, uuid } from "@/lib/validation/common";

export interface OrderActionState {
  error?: string;
  ok?: string;
}

/** Errores de las funciones de base de datos `admin_*`, en lenguaje claro. */
const DB_ERRORS: Record<string, string> = {
  no_autorizado: "Tu sesión no tiene permiso. Vuelve a iniciar sesión con tu código de 2 pasos.",
  pedido_no_encontrado: "No encontramos el pedido.",
  estado_invalido: "El pedido ya cambió de estado (quizá otra persona o el cliente lo modificó). Actualiza la página.",
  comprobante_no_encontrado: "No encontramos ese comprobante.",
  comprobante_no_vigente: "El cliente cambió el comprobante mientras lo revisabas. Actualiza la página para ver el nuevo.",
  motivo_invalido: "Escribe un motivo de al menos 3 caracteres.",
  reserva_inconsistente: "La reserva de stock de este pedido no está activa. Revísalo antes de aprobar.",
};
const GENERIC_ERROR = "No pudimos completar el cambio. Inténtalo de nuevo.";

function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function done(ok: string): OrderActionState {
  // Refresca la lista, el contador del menú y el detalle.
  revalidatePath("/admin", "layout");
  return { ok };
}

/**
 * Cada cambio de estado es una función de base de datos que bloquea el pedido, verifica el estado
 * anterior y mueve stock y comprobante en una transacción. Se llama con la sesión del
 * administrador, así la base comprueba por su cuenta que sea admin con 2FA (is_admin()).
 */
export async function aprobarPedido(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      orderId: uuid,
      proofId: uuid,
      verificado: z.literal("on", { error: "Confirma que viste el dinero en tu cuenta bancaria." }),
    })
    .safeParse({
      orderId: str(formData, "orderId"),
      proofId: str(formData, "proofId"),
      verificado: str(formData, "verificado"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_approve_order", {
    p_order_id: parsed.data.orderId,
    p_proof_id: parsed.data.proofId,
  });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  notifyPaymentApproved(parsed.data.orderId);
  return done("Pago aprobado. Se descontó el stock.");
}

const reasonFields = z.object({ orderId: uuid, motivo: text(3, 500) });

export async function rechazarComprobante(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const parsed = reasonFields.extend({ proofId: uuid }).safeParse({
    orderId: str(formData, "orderId"),
    proofId: str(formData, "proofId"),
    motivo: str(formData, "motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reject_proof", {
    p_order_id: parsed.data.orderId,
    p_proof_id: parsed.data.proofId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  notifyProofRejected(parsed.data.orderId, parsed.data.proofId, parsed.data.motivo);
  return done("Comprobante rechazado. El cliente puede subir otro y tiene un plazo nuevo.");
}

export async function rechazarPedido(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const parsed = reasonFields.safeParse({ orderId: str(formData, "orderId"), motivo: str(formData, "motivo") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reject_order", {
    p_order_id: parsed.data.orderId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  return done("Pedido rechazado. Se liberó el stock reservado.");
}

export async function cancelarPedido(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const parsed = reasonFields.safeParse({ orderId: str(formData, "orderId"), motivo: str(formData, "motivo") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_order", {
    p_order_id: parsed.data.orderId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  notifyOrderCancelled(parsed.data.orderId, parsed.data.motivo);
  return done("Pedido cancelado. Se liberó el stock reservado.");
}

const idField = z.object({ orderId: uuid });

/** Pagado -> enviado. La función de base de datos bloquea el pedido y verifica el estado anterior. */
export async function marcarEnviado(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const parsed = idField.safeParse({ orderId: str(formData, "orderId") });
  if (!parsed.success) return { error: "No encontramos el pedido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_shipped", { p_order_id: parsed.data.orderId });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  notifyOrderShipped(parsed.data.orderId);
  return done("Pedido marcado como enviado.");
}

/** Enviado -> entregado. */
export async function marcarEntregado(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdmin();
  const parsed = idField.safeParse({ orderId: str(formData, "orderId") });
  if (!parsed.success) return { error: "No encontramos el pedido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_delivered", { p_order_id: parsed.data.orderId });
  if (error) return { error: DB_ERRORS[error.message] ?? GENERIC_ERROR };
  return done("Pedido marcado como entregado.");
}
