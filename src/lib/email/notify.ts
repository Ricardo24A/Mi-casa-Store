import "server-only";
import { after } from "next/server";
import { loadOrder, loadStoreData, runEmailJob, type OrderEmailData, type StoreEmailData } from "./mailer";
import { safely, type EmailJob } from "./send-core.ts";
import * as T from "./templates.ts";

/**
 * Puntos de entrada de los correos transaccionales. Cada función se llama DESPUÉS de que el cambio ya se
 * guardó en la base de datos, devuelve enseguida (void) y envía con `after()`: el usuario no espera y un
 * fallo del correo no puede romper ni revertir el flujo. Los correos de Supabase Auth (confirmar correo,
 * recuperar contraseña) NO pasan por aquí.
 *
 * Referencias para no duplicar (ver `email_log`): lo que ocurre una vez por pedido usa su referencia
 * (MC-…); lo que puede repetirse legítimamente usa el id del comprobante o del mensaje.
 */

function schedule(label: string, work: () => Promise<unknown>) {
  after(() => safely(work, (m) => console.log(m), label));
}

async function customerJob(
  orderId: string,
  tipo: T.EmailType,
  referenciaDelEvento: (o: OrderEmailData) => string,
  render: (ctx: T.TemplateContext, o: OrderEmailData, store: StoreEmailData) => ReturnType<typeof T.proofReceived>,
) {
  const [order, store] = await Promise.all([loadOrder({ id: orderId }), loadStoreData()]);
  if (!order) return;
  const job: EmailJob = {
    tipo,
    referencia: referenciaDelEvento(order),
    to: order.email,
    build: () => render(store.context, order, store),
  };
  await runEmailJob(job, store.nombre);
}

// 1) Pedido creado
export interface OrderCreatedInput {
  referencia: string;
  items: { nombre: string; cantidad: number; precioUnitario: number }[];
  subtotal: number;
  descuento: number;
  descuentoTransferencia: number;
  envio: number;
  envioPorCoordinar: boolean;
  total: number;
  direccion: T.OrderCreatedData["direccion"];
}

export function notifyOrderCreated(input: OrderCreatedInput) {
  schedule("pedido_creado", async () => {
    const [order, store] = await Promise.all([loadOrder({ referencia: input.referencia }), loadStoreData()]);
    if (!order) return;
    await runEmailJob(
      {
        tipo: "pedido_creado",
        referencia: order.referencia,
        to: order.email,
        build: () => T.orderCreated(store.context, { ...input, nombre: order.nombre, venceEn: order.venceEn, cuentas: store.cuentas }),
      },
      store.nombre,
    );
  });
}

// 2) Comprobante recibido (cliente) y 7) comprobante por revisar (dueño). Cada subida es un evento propio.
export function notifyProofUploaded(orderId: string, proofId: string) {
  schedule("comprobante_recibido", () =>
    customerJob(orderId, "comprobante_recibido", () => proofId, (ctx, o) => T.proofReceived(ctx, { referencia: o.referencia, nombre: o.nombre })),
  );
  schedule("dueno_comprobante", async () => {
    const [order, store] = await Promise.all([loadOrder({ id: orderId }), loadStoreData()]);
    if (!order) return;
    await runEmailJob(
      {
        tipo: "dueno_comprobante",
        referencia: proofId,
        to: store.ownerTo,
        build: () => T.ownerProofToReview(store.context, { referencia: order.referencia, total: order.total }),
      },
      store.nombre,
    );
  });
}

// 3) Pago aprobado
export function notifyPaymentApproved(orderId: string) {
  schedule("pago_aprobado", () =>
    customerJob(orderId, "pago_aprobado", (o) => o.referencia, (ctx, o) => T.paymentApproved(ctx, { referencia: o.referencia, nombre: o.nombre, total: o.total })),
  );
}

// 4) Comprobante rechazado (cada comprobante rechazado es un evento distinto)
export function notifyProofRejected(orderId: string, proofId: string, motivo: string) {
  schedule("comprobante_rechazado", () =>
    customerJob(orderId, "comprobante_rechazado", () => proofId, (ctx, o) => T.proofRejected(ctx, { referencia: o.referencia, nombre: o.nombre, motivo })),
  );
}

// 5) Pedido enviado
export function notifyOrderShipped(orderId: string) {
  schedule("pedido_enviado", () =>
    customerJob(orderId, "pedido_enviado", (o) => o.referencia, (ctx, o) => T.orderShipped(ctx, { referencia: o.referencia, nombre: o.nombre })),
  );
}

// 6) Pedido cancelado por el dueño (el vencimiento automático no tiene acción de la app detrás: sin correo)
export function notifyOrderCancelled(orderId: string, motivo: string | null) {
  schedule("pedido_cancelado", () =>
    customerJob(orderId, "pedido_cancelado", (o) => o.referencia, (ctx, o) => T.orderCancelled(ctx, { referencia: o.referencia, nombre: o.nombre, motivo })),
  );
}

// 8) Mensaje de contacto nuevo (solo se llega aquí si create_contact_message lo aceptó: ya pasó los límites de 3 por correo y 10 por IP por hora)
export function notifyOwnerContactMessage(messageId: string, data: { nombre: string; asunto: string | null; mensaje: string }) {
  schedule("dueno_mensaje", async () => {
    const store = await loadStoreData();
    await runEmailJob(
      {
        tipo: "dueno_mensaje",
        referencia: messageId,
        to: store.ownerTo,
        build: () => T.ownerContactMessage(store.context, data),
      },
      store.nombre,
    );
  });
}
