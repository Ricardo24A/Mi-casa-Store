/**
 * Modelo de los documentos legales. El texto es del cliente (docs/legal/Documentos_Legales.pdf) y se publica
 * tal cual: aquí solo hay estructura. Lo único que no es texto fijo es el número del plazo de pago.
 */

/** Un tramo de texto: normal, negrita, cursiva, o el plazo de pago real (horas_limite_pago de Configuración). */
export type Run = string | { b: string } | { i: string } | { plazo: true; b?: boolean };

export type LegalBlock =
  | { t: "h2"; text: string }
  | { t: "p"; runs: Run[] }
  | { t: "ul"; items: Run[][] }
  /** Recuadro: advertencia (naranja) o información (azul/gris). El título puede ir en la misma línea. */
  | { t: "note"; tone: "warning" | "info"; title: string; titleInline?: boolean; paragraphs: Run[][] };

export interface LegalDoc {
  slug: "privacidad" | "terminos" | "cookies";
  titulo: string;
  /** "2 de octubre de 2026", como lo escribió el cliente. */
  actualizado: string;
  /** AAAA-MM-DD: identifica la versión del texto (se guarda al aceptar). */
  version: string;
  bloques: LegalBlock[];
}
