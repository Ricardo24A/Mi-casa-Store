/** Reglas de subida (CLAUDE.md sección 10). Se aplican en el servidor. */

/**
 * Comprobantes: 4 MB. Las funciones de Vercel rechazan cuerpos de más de 4,5 MB, así que un límite
 * mayor fallaría en producción. `serverActions.bodySizeLimit` (next.config.ts) deja un margen para
 * el multipart, y el navegador reduce las fotos antes de enviarlas (ver `src/lib/proof-file.ts`).
 */
export const PROOF_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const PROOF_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export const PROOF_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const satisfies Record<(typeof PROOF_MIME_TYPES)[number], string>;

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type DetectedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** Detecta el tipo real por los primeros bytes (no por la extensión). Null si no es permitido. */
export function sniffMime(bytes: Uint8Array): DetectedMime | null {
  const at = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export type ProofCheck =
  | { ok: true; mime: (typeof PROOF_MIME_TYPES)[number]; extension: string }
  | { ok: false; error: string };

/**
 * Validación de un comprobante EN EL SERVIDOR, sobre los bytes recibidos: tamaño y tipo real por
 * los primeros bytes (el nombre y el tipo que declara el navegador no cuentan). Solo JPG, PNG y PDF.
 */
export function checkProofBytes(bytes: Uint8Array): ProofCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.byteLength > PROOF_MAX_BYTES) return { ok: false, error: "El archivo pesa más de 4 MB." };
  const mime = sniffMime(bytes);
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "application/pdf") {
    return { ok: false, error: "Solo se admiten archivos JPG, PNG o PDF." };
  }
  return { ok: true, mime, extension: PROOF_EXTENSION[mime] };
}
