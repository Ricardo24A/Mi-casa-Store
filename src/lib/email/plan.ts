import type { BankAccountInfo } from "./render.ts";
import type { EmailJob } from "./send-core.ts";
import * as T from "./templates.ts";

/**
 * Qué correos produce cada evento, con datos ya cargados. Puro (sin Next, sin base de datos): así se
 * prueba que cada evento intenta lo que debe, incluido pedido_creado al terminar el checkout.
 * `notify.ts` carga los datos, llama a estas funciones y las ejecuta en orden con `processEmails`.
 *
 * Referencias para no duplicar (ver `email_log`): lo que ocurre una vez por pedido usa su referencia
 * (MC-…); lo que puede repetirse legítimamente usa el id del comprobante o del mensaje.
 */

export interface PlanStore {
  context: T.TemplateContext;
  cuentas: BankAccountInfo[];
  ownerTo: string | null;
}

export interface PlanOrder {
  referencia: string;
  nombre: string;
  email: string;
  total: number;
}

/** Cómo decir que el aviso al dueño no tiene a quién llegar. */
export const OWNER_OMIT_REASON = "sin destinatario del dueño: define EMAIL_OWNER_TO o el correo de contacto en Configuración";

export interface OrderCreatedPlanInput {
  referencia: string;
  /** Correo y nombre de la cuenta que hizo el pedido (los mismos que se guardaron en el pedido). */
  to: string;
  nombre: string;
  venceEn: string | Date;
  items: T.OrderCreatedData["items"];
  subtotal: number;
  descuento: number;
  descuentoTransferencia: number;
  envio: number;
  envioPorCoordinar: boolean;
  total: number;
  direccion: T.OrderCreatedData["direccion"];
}

export function planOrderCreated(store: PlanStore, input: OrderCreatedPlanInput): EmailJob[] {
  const { to, ...data } = input;
  return [
    {
      tipo: "pedido_creado",
      referencia: input.referencia,
      to,
      build: () => T.orderCreated(store.context, { ...data, cuentas: store.cuentas }),
    },
  ];
}

/** Cada subida (o reemplazo) es un evento: el cliente recibe la confirmación y el dueño, el aviso, en ese orden. */
export function planProofUploaded(store: PlanStore, order: PlanOrder, proofId: string): EmailJob[] {
  return [
    {
      tipo: "comprobante_recibido",
      referencia: proofId,
      to: order.email,
      build: () => T.proofReceived(store.context, { referencia: order.referencia, nombre: order.nombre }),
    },
    {
      tipo: "dueno_comprobante",
      referencia: proofId,
      to: store.ownerTo,
      omitReason: OWNER_OMIT_REASON,
      build: () => T.ownerProofToReview(store.context, { referencia: order.referencia, total: order.total }),
    },
  ];
}

export function planPaymentApproved(store: PlanStore, order: PlanOrder): EmailJob[] {
  return [
    {
      tipo: "pago_aprobado",
      referencia: order.referencia,
      to: order.email,
      build: () => T.paymentApproved(store.context, { referencia: order.referencia, nombre: order.nombre, total: order.total }),
    },
  ];
}

export function planProofRejected(store: PlanStore, order: PlanOrder, proofId: string, motivo: string): EmailJob[] {
  return [
    {
      tipo: "comprobante_rechazado",
      referencia: proofId,
      to: order.email,
      build: () => T.proofRejected(store.context, { referencia: order.referencia, nombre: order.nombre, motivo }),
    },
  ];
}

export function planOrderShipped(store: PlanStore, order: PlanOrder): EmailJob[] {
  return [
    {
      tipo: "pedido_enviado",
      referencia: order.referencia,
      to: order.email,
      build: () => T.orderShipped(store.context, { referencia: order.referencia, nombre: order.nombre }),
    },
  ];
}

export function planOrderCancelled(store: PlanStore, order: PlanOrder, motivo: string | null): EmailJob[] {
  return [
    {
      tipo: "pedido_cancelado",
      referencia: order.referencia,
      to: order.email,
      build: () => T.orderCancelled(store.context, { referencia: order.referencia, nombre: order.nombre, motivo }),
    },
  ];
}

export function planOwnerContactMessage(
  store: PlanStore,
  messageId: string,
  data: { nombre: string; asunto: string | null; mensaje: string },
): EmailJob[] {
  return [
    {
      tipo: "dueno_mensaje",
      referencia: messageId,
      to: store.ownerTo,
      omitReason: OWNER_OMIT_REASON,
      build: () => T.ownerContactMessage(store.context, data),
    },
  ];
}
