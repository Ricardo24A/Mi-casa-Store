import { oneLine, renderEmail, type BankAccountInfo, type Block, type EmailContent, type RenderedEmail, type StoreFooter } from "./render.ts";

/**
 * Las ocho plantillas. Solo dicen lo que ya es verdad en la base de datos: sin plazos de revisión, sin
 * promesas comerciales ni frases de marketing. Los enlaces salen de `siteUrl` (NEXT_PUBLIC_SITE_URL) y
 * apuntan a rutas que existen: /confirmacion/[referencia] (el pedido del cliente: pago, comprobante y
 * estado) y /admin/pedidos/[referencia] o /admin/mensajes (el dueño).
 */

export type EmailType =
  | "pedido_creado"
  | "comprobante_recibido"
  | "pago_aprobado"
  | "comprobante_rechazado"
  | "pedido_enviado"
  | "pedido_cancelado"
  | "pedido_rechazado"
  | "dueno_comprobante"
  | "dueno_mensaje";

const usd = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const when = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short", timeZone: "America/Guayaquil" });

export const formatMoney = (value: number) => usd.format(value);
export const formatWhen = (value: string | Date) => when.format(new Date(value));

export interface TemplateContext {
  store: StoreFooter;
  /** NEXT_PUBLIC_SITE_URL, sin barra final. */
  siteUrl: string;
}

const orderUrl = (ctx: TemplateContext, referencia: string) => `${ctx.siteUrl}/confirmacion/${encodeURIComponent(referencia)}`;

/** Documentos legales que existen como páginas de la tienda (ver src/content/legal). */
export const EMAIL_LEGAL_PATHS = [
  { label: "Privacidad", path: "/privacidad" },
  { label: "Términos y Condiciones", path: "/terminos" },
  { label: "Cookies", path: "/cookies" },
] as const;

function build(ctx: TemplateContext, subject: string, preheader: string, title: string, blocks: Block[]): RenderedEmail {
  const links = EMAIL_LEGAL_PATHS.map((l) => ({ label: l.label, url: `${ctx.siteUrl}${l.path}` }));
  const content: EmailContent = { subject, preheader, title, blocks, store: { ...ctx.store, links } };
  return renderEmail(content);
}

const hello = (nombre: string): Block => ({ t: "p", text: `Hola, ${oneLine(nombre, 120)}.` });

// ---------------------------------------------------------------------------
// Al cliente
// ---------------------------------------------------------------------------

export interface OrderCreatedData {
  referencia: string;
  nombre: string;
  items: { nombre: string; cantidad: number; precioUnitario: number }[];
  subtotal: number;
  /** Rebaja de los descuentos de producto. */
  descuento: number;
  descuentoTransferencia: number;
  envio: number;
  /** El costo de envío está sin definir: se muestra "A coordinar" y no se suma. */
  envioPorCoordinar: boolean;
  total: number;
  venceEn: string | Date;
  cuentas: BankAccountInfo[];
  /** Dirección de envío escrita por el cliente (se escapa como todo el texto). */
  direccion: { destinatario: string; direccion: string; ciudad: string; provincia: string } | null;
}

export function orderCreated(ctx: TemplateContext, d: OrderCreatedData): RenderedEmail {
  const rows: { label: string; value: string; strong?: boolean }[] = [{ label: "Subtotal", value: formatMoney(d.subtotal) }];
  if (d.descuento > 0) rows.push({ label: "Descuentos", value: `-${formatMoney(d.descuento)}` });
  if (d.descuentoTransferencia > 0) rows.push({ label: "Descuento por transferencia", value: `-${formatMoney(d.descuentoTransferencia)}` });
  rows.push({ label: "Envío", value: d.envioPorCoordinar ? "A coordinar" : formatMoney(d.envio) });
  rows.push({ label: "Total a transferir", value: formatMoney(d.total), strong: true });

  const blocks: Block[] = [
    hello(d.nombre),
    { t: "p", text: `Recibimos tu pedido ${d.referencia}. Para confirmarlo, transfiere el monto exacto y sube el comprobante.` },
    {
      t: "items",
      items: d.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, subtotal: formatMoney(i.precioUnitario * i.cantidad) })),
    },
    { t: "rows", rows },
  ];
  if (d.direccion) {
    blocks.push({
      t: "p",
      text: `Envío a: ${oneLine(d.direccion.destinatario, 120)}, ${oneLine(d.direccion.direccion, 200)}, ${oneLine(d.direccion.ciudad, 80)}, ${oneLine(d.direccion.provincia, 80)}.`,
    });
  }
  blocks.push({ t: "p", text: d.cuentas.length > 1 ? "Puedes transferir a cualquiera de estas cuentas:" : "Cuenta para la transferencia:" });
  blocks.push({ t: "accounts", accounts: d.cuentas });
  blocks.push({ t: "p", text: `Escribe ${d.referencia} como concepto de la transferencia.` });
  blocks.push({
    t: "p",
    text: `Tienes hasta el ${formatWhen(d.venceEn)} para pagar. Pasado ese plazo el pedido vence y se libera el stock reservado.`,
  });
  blocks.push({
    t: "p",
    text: "Para subir el comprobante, abre tu pedido con el botón de abajo y adjunta una foto o un PDF (JPG, PNG o PDF, hasta 4 MB). Tu pedido se confirma cuando revisamos el comprobante.",
  });
  blocks.push({ t: "button", label: "Abrir mi pedido", url: orderUrl(ctx, d.referencia) });
  return build(ctx, `Recibimos tu pedido ${d.referencia}`, `Total a transferir: ${formatMoney(d.total)}`, `Recibimos tu pedido ${d.referencia}`, blocks);
}

export interface OrderRef {
  referencia: string;
  nombre: string;
}

export function proofReceived(ctx: TemplateContext, d: OrderRef): RenderedEmail {
  return build(ctx, `Recibimos tu comprobante: pedido ${d.referencia}`, "Lo estamos revisando.", "Recibimos tu comprobante", [
    hello(d.nombre),
    { t: "p", text: `Recibimos el comprobante de tu pedido ${d.referencia} y lo estamos revisando. Te avisaremos por correo cuando lo hayamos revisado.` },
    { t: "button", label: "Ver mi pedido", url: orderUrl(ctx, d.referencia) },
  ]);
}

export function paymentApproved(ctx: TemplateContext, d: OrderRef & { total: number }): RenderedEmail {
  return build(ctx, `Pago aprobado: pedido ${d.referencia}`, "Confirmamos tu pago.", "Confirmamos tu pago", [
    hello(d.nombre),
    { t: "p", text: `Aprobamos el pago de tu pedido ${d.referencia} por ${formatMoney(d.total)}. Te avisaremos por correo cuando lo enviemos.` },
    { t: "button", label: "Ver mi pedido", url: orderUrl(ctx, d.referencia) },
  ]);
}

export function proofRejected(ctx: TemplateContext, d: OrderRef & { motivo: string }): RenderedEmail {
  return build(ctx, `Tu comprobante del pedido ${d.referencia} fue rechazado`, "Necesitamos que subas uno nuevo.", "No pudimos aprobar tu comprobante", [
    hello(d.nombre),
    { t: "p", text: `Revisamos el comprobante de tu pedido ${d.referencia} y no pudimos aprobarlo.` },
    { t: "note", label: "Motivo", text: d.motivo },
    { t: "p", text: "Puedes subir un comprobante nuevo desde tu pedido, mientras el plazo de pago siga vigente." },
    { t: "button", label: "Subir un comprobante nuevo", url: orderUrl(ctx, d.referencia) },
  ]);
}

export function orderShipped(ctx: TemplateContext, d: OrderRef): RenderedEmail {
  return build(ctx, `Tu pedido ${d.referencia} fue enviado`, "Marcamos tu pedido como enviado.", "Tu pedido fue enviado", [
    hello(d.nombre),
    { t: "p", text: `Marcamos tu pedido ${d.referencia} como enviado.` },
    { t: "p", text: "Si tienes preguntas sobre tu pedido, escríbenos o llámanos con los datos que están al final de este correo." },
    { t: "button", label: "Ver mi pedido", url: orderUrl(ctx, d.referencia) },
  ]);
}

export function orderCancelled(ctx: TemplateContext, d: OrderRef & { motivo: string | null }): RenderedEmail {
  const blocks: Block[] = [hello(d.nombre), { t: "p", text: `Cancelamos tu pedido ${d.referencia}.` }];
  if (d.motivo) blocks.push({ t: "note", label: "Motivo", text: d.motivo });
  blocks.push({ t: "p", text: "Si ya hiciste una transferencia por este pedido, escríbenos con los datos que están al final de este correo." });
  blocks.push({ t: "button", label: "Ver mi pedido", url: orderUrl(ctx, d.referencia) });
  return build(ctx, `Pedido ${d.referencia} cancelado`, "Cancelamos tu pedido.", "Cancelamos tu pedido", blocks);
}

export function orderRejected(ctx: TemplateContext, d: OrderRef & { motivo: string }): RenderedEmail {
  return build(ctx, `Pedido ${d.referencia} rechazado`, "Rechazamos tu pedido.", "Rechazamos tu pedido", [
    hello(d.nombre),
    { t: "p", text: `Rechazamos tu pedido ${d.referencia}.` },
    { t: "note", label: "Motivo", text: d.motivo },
    { t: "p", text: "Si tienes preguntas, escríbenos o llámanos con los datos que están al final de este correo." },
    { t: "button", label: "Ver mi pedido", url: orderUrl(ctx, d.referencia) },
  ]);
}

// ---------------------------------------------------------------------------
// Al dueño
// ---------------------------------------------------------------------------

export function ownerProofToReview(ctx: TemplateContext, d: { referencia: string; total: number }): RenderedEmail {
  return build(ctx, `Comprobante por revisar: pedido ${d.referencia}`, "Hay un comprobante nuevo.", "Comprobante por revisar", [
    { t: "p", text: `El pedido ${d.referencia} (${formatMoney(d.total)}) tiene un comprobante esperando tu revisión.` },
    { t: "p", text: "Apruébalo solo cuando veas el dinero reflejado en tu cuenta bancaria, no solo por la imagen." },
    { t: "button", label: "Revisar el pedido", url: `${ctx.siteUrl}/admin/pedidos/${encodeURIComponent(d.referencia)}` },
  ]);
}

export const CONTACT_PREVIEW_CHARS = 140;

export function ownerContactMessage(ctx: TemplateContext, d: { nombre: string; asunto: string | null; mensaje: string }): RenderedEmail {
  const chars = Array.from(oneLine(d.mensaje, 5000));
  const preview = chars.length > CONTACT_PREVIEW_CHARS ? `${chars.slice(0, CONTACT_PREVIEW_CHARS).join("").trimEnd()}…` : chars.join("");
  const asunto = d.asunto ? oneLine(d.asunto, 120) : null;
  return build(ctx, `Nuevo mensaje de contacto: ${oneLine(d.nombre, 80)}`, preview, "Nuevo mensaje de contacto", [
    { t: "rows", rows: [{ label: "Nombre", value: oneLine(d.nombre, 120) }, { label: "Asunto", value: asunto ?? "Sin asunto" }] },
    { t: "note", label: "Vista previa", text: preview },
    { t: "p", text: "El mensaje completo y los datos para responder están en la bandeja de mensajes." },
    { t: "button", label: "Abrir la bandeja de mensajes", url: `${ctx.siteUrl}/admin/mensajes` },
  ]);
}
