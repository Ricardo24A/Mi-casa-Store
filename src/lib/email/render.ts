/**
 * Modelo de contenido de los correos y sus dos representaciones (HTML con tablas y estilos en línea, y
 * texto plano). Sin dependencias de servidor ni alias, para probarlo con node --test.
 *
 * TODO texto que llega aquí se trata como dato: el HTML solo se arma con `esc()`, nunca se interpola
 * crudo. Los colores son los de la tienda (fondo #F0DFC6, verde #3E5C4B).
 */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sin saltos de línea ni caracteres de control (asuntos y líneas sueltas). */
export function oneLine(value: unknown, max = 200): string {
  const clean = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(clean).slice(0, max).join("");
}

export interface BankAccountInfo {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  identificacion: string;
}

export type Block =
  | { t: "p"; text: string }
  /** Recuadro destacado (motivo de un rechazo, por ejemplo). */
  | { t: "note"; label: string; text: string }
  | { t: "items"; items: { nombre: string; cantidad: number; subtotal: string }[] }
  | { t: "rows"; rows: { label: string; value: string; strong?: boolean }[] }
  | { t: "accounts"; accounts: BankAccountInfo[] }
  | { t: "button"; label: string; url: string };

export interface StoreFooter {
  nombre: string;
  email: string | null;
  /** Ya con formato visual (099 123 4567). */
  telefonos: string[];
  direccion: string | null;
  horario: string | null;
  /** Enlaces del pie (documentos legales), con URL absoluta. */
  links?: { label: string; url: string }[];
}

export interface EmailContent {
  subject: string;
  /** Texto corto que algunos clientes de correo muestran junto al asunto. */
  preheader: string;
  title: string;
  blocks: Block[];
  store: StoreFooter;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = "#2A2521";
const INK_SOFT = "#5E554B";
const ACCENT = "#3E5C4B";
const BG = "#F0DFC6";
const LINE = "#D9C5A6";

function htmlBlock(b: Block): string {
  switch (b.t) {
    case "p":
      return `<tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${INK};">${esc(b.text)}</td></tr>`;
    case "note":
      return `<tr><td style="padding:0 0 16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#F8EDE8;border-left:4px solid #94462A;padding:12px 16px;font-family:${FONT};font-size:15px;line-height:22px;color:#94462A;"><strong>${esc(b.label)}</strong><br>${esc(b.text).replace(/\r?\n/g, "<br>")}</td></tr></table></td></tr>`;
    case "items":
      return `<tr><td style="padding:0 0 8px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${b.items
        .map(
          (i) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;line-height:22px;color:${INK};">${esc(i.cantidad)} × ${esc(i.nombre)}</td><td align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;line-height:22px;color:${INK};white-space:nowrap;">${esc(i.subtotal)}</td></tr>`,
        )
        .join("")}</table></td></tr>`;
    case "rows":
      return `<tr><td style="padding:0 0 16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${b.rows
        .map(
          (r) =>
            `<tr><td style="padding:4px 0;font-family:${FONT};font-size:${r.strong ? 17 : 15}px;line-height:22px;color:${r.strong ? INK : INK_SOFT};${r.strong ? "font-weight:600;" : ""}">${esc(r.label)}</td><td align="right" style="padding:4px 0 4px 12px;font-family:${FONT};font-size:${r.strong ? 17 : 15}px;line-height:22px;color:${INK};${r.strong ? "font-weight:600;" : ""}">${esc(r.value)}</td></tr>`,
        )
        .join("")}</table></td></tr>`;
    case "accounts":
      return `<tr><td style="padding:0 0 8px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${b.accounts
        .map(
          (a) =>
            `<tr><td style="padding:0 0 12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:1px solid ${LINE};border-radius:8px;padding:12px 16px;font-family:${FONT};font-size:15px;line-height:22px;color:${INK};"><strong>${esc(a.banco)}</strong> · ${esc(a.tipo)}<br>Número: ${esc(a.numero)}<br>Titular: ${esc(a.titular)}<br>Identificación: ${esc(a.identificacion)}</td></tr></table></td></tr>`,
        )
        .join("")}</table></td></tr>`;
    case "button":
      return `<tr><td style="padding:8px 0 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${ACCENT}" style="background-color:${ACCENT};border-radius:8px;"><a href="${esc(b.url)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;">${esc(b.label)}</a></td></tr></table><div style="padding-top:8px;font-family:${FONT};font-size:13px;line-height:18px;color:${INK_SOFT};word-break:break-all;">Si el botón no funciona, copia este enlace: ${esc(b.url)}</div></td></tr>`;
  }
}

function footerLines(s: StoreFooter): string[] {
  const lines = [s.nombre];
  if (s.direccion) lines.push(s.direccion);
  if (s.telefonos.length > 0) lines.push(`Teléfono: ${s.telefonos.join(" · ")}`);
  if (s.email) lines.push(`Correo: ${s.email}`);
  if (s.horario) lines.push(`Horario de atención: ${s.horario}`);
  return lines;
}

function footerLinksHtml(s: StoreFooter): string {
  if (!s.links?.length) return "";
  return `<br>${s.links.map((l) => `<a href="${esc(l.url)}" style="color:${INK_SOFT};text-decoration:underline;">${esc(l.label)}</a>`).join(" · ")}`;
}

function footerLinksText(s: StoreFooter): string[] {
  return (s.links ?? []).map((l) => `${l.label}: ${l.url}`);
}

export function renderHtml(c: EmailContent): string {
  const subject = oneLine(c.subject);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background-color:${BG};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(oneLine(c.preheader, 140))}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color:${BG};"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;"><tr><td style="padding:0 4px 16px 4px;font-family:${FONT};font-size:22px;font-weight:600;color:${ACCENT};">${esc(c.store.nombre)}</td></tr><tr><td style="background-color:#FFFFFF;border:1px solid ${LINE};border-radius:12px;padding:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:22px;line-height:28px;font-weight:600;color:${INK};">${esc(c.title)}</td></tr>${c.blocks.map(htmlBlock).join("")}</table></td></tr><tr><td style="padding:16px 4px 0 4px;font-family:${FONT};font-size:13px;line-height:20px;color:${INK_SOFT};">${footerLines(c.store).map(esc).join("<br>")}${footerLinksHtml(c.store)}</td></tr></table></td></tr></table></body></html>`;
}

function textBlock(b: Block): string {
  switch (b.t) {
    case "p":
      return b.text;
    case "note":
      return `${b.label}\n${b.text}`;
    case "items":
      return b.items.map((i) => `- ${i.cantidad} x ${i.nombre}: ${i.subtotal}`).join("\n");
    case "rows":
      return b.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    case "accounts":
      return b.accounts
        .map((a) => `${a.banco} (${a.tipo})\n  Número: ${a.numero}\n  Titular: ${a.titular}\n  Identificación: ${a.identificacion}`)
        .join("\n\n");
    case "button":
      return `${b.label}: ${b.url}`;
  }
}

export function renderText(c: EmailContent): string {
  return [c.title, ...c.blocks.map(textBlock), "--", ...footerLines(c.store), ...footerLinksText(c.store)].join("\n\n").replace(/\n\n--\n\n/, "\n\n--\n");
}

export function renderEmail(c: EmailContent): RenderedEmail {
  return { subject: oneLine(c.subject, 200), html: renderHtml(c), text: renderText(c) };
}
