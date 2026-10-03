import "server-only";
import { after } from "next/server";
import { loadOrder, loadStoreData, runEmailJobs } from "./mailer";
import * as P from "./plan.ts";
import { safely } from "./send-core.ts";

/**
 * Puntos de entrada de los correos transaccionales. Cada función se llama DESPUÉS de que el cambio ya se
 * guardó en la base de datos, devuelve enseguida (void) y envía con UN `after()` por evento: el usuario no
 * espera, un fallo del correo no puede romper ni revertir el flujo, y los correos de un mismo evento
 * (cliente y dueño) salen en orden y con una pausa corta. Los correos de Supabase Auth (confirmar correo,
 * recuperar contraseña) NO pasan por aquí.
 *
 * Nada se pierde en silencio: al programar se escribe `[email:programado]`, y cada salida temprana o fallo deja
 * su línea `[email:omitido]` o `[email:fallido]` (y una fila en `email_log` cuando hay un pedido o mensaje).
 */

const log = (message: string) => console.log(message);

function schedule(label: string, work: () => Promise<unknown>) {
  log(`[email:programado] ${label}`);
  after(() => safely(work, log, label));
}

/** Para los eventos que solo conocen el id del pedido: lo lee y arma los correos. */
async function forOrder(label: string, orderId: string, plan: (store: Awaited<ReturnType<typeof loadStoreData>>, order: NonNullable<Awaited<ReturnType<typeof loadOrder>>>) => ReturnType<typeof P.planPaymentApproved>) {
  const [order, store] = await Promise.all([loadOrder({ id: orderId }), loadStoreData()]);
  if (!order) {
    log(`[email:omitido] tipo=${label} motivo=no se pudo leer el pedido`);
    return;
  }
  await runEmailJobs(plan(store, order), store.nombre);
}

// 1) Pedido creado. Recibe todo lo que necesita (destinatario, nombre, plazo): no relee el pedido.
export type OrderCreatedInput = P.OrderCreatedPlanInput;

export function notifyOrderCreated(input: OrderCreatedInput) {
  schedule("pedido_creado", async () => {
    const store = await loadStoreData();
    await runEmailJobs(P.planOrderCreated(store, input), store.nombre);
  });
}

// 2) Comprobante recibido (cliente) y 7) comprobante por revisar (dueño): un evento, dos correos, en ese orden.
export function notifyProofUploaded(orderId: string, proofId: string) {
  schedule("comprobante_recibido+dueno_comprobante", () => forOrder("comprobante_recibido", orderId, (store, order) => P.planProofUploaded(store, order, proofId)));
}

// 3) Pago aprobado
export function notifyPaymentApproved(orderId: string) {
  schedule("pago_aprobado", () => forOrder("pago_aprobado", orderId, P.planPaymentApproved));
}

// 4) Comprobante rechazado (cada comprobante rechazado es un evento distinto)
export function notifyProofRejected(orderId: string, proofId: string, motivo: string) {
  schedule("comprobante_rechazado", () => forOrder("comprobante_rechazado", orderId, (store, order) => P.planProofRejected(store, order, proofId, motivo)));
}

// 5) Pedido enviado
export function notifyOrderShipped(orderId: string) {
  schedule("pedido_enviado", () => forOrder("pedido_enviado", orderId, P.planOrderShipped));
}

// 6) Pedido cancelado por el dueño (el vencimiento automático no tiene acción de la app detrás: sin correo)
export function notifyOrderCancelled(orderId: string, motivo: string | null) {
  schedule("pedido_cancelado", () => forOrder("pedido_cancelado", orderId, (store, order) => P.planOrderCancelled(store, order, motivo)));
}

// 6b) Pedido rechazado por el dueño (admin_reject_order)
export function notifyOrderRejected(orderId: string, motivo: string) {
  schedule("pedido_rechazado", () => forOrder("pedido_rechazado", orderId, (store, order) => P.planOrderRejected(store, order, motivo)));
}

// 8) Mensaje de contacto nuevo (solo se llega aquí si create_contact_message lo aceptó: ya pasó los límites de 3 por correo y 10 por IP por hora)
export function notifyOwnerContactMessage(messageId: string, data: { nombre: string; asunto: string | null; mensaje: string }) {
  schedule("dueno_mensaje", async () => {
    const store = await loadStoreData();
    await runEmailJobs(P.planOwnerContactMessage(store, messageId, data), store.nombre);
  });
}
