/** Reglas de subida (CLAUDE.md sección 10). Se aplican en el servidor. */

export const PROOF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PROOF_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

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
