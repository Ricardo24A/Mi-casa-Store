// Preparación del comprobante en el NAVEGADOR: reduce las fotos para que quepan en el límite de
// 4 MB de Vercel. Es solo comodidad: el servidor vuelve a validar tamaño y tipo real del archivo.

/** Límite del archivo (igual que PROOF_MAX_BYTES; sin importar de `files.ts` para no acoplar al servidor). */
export const PROOF_LIMIT_BYTES = 4 * 1024 * 1024;
/** Meta al comprimir: deja margen bajo el límite. */
const TARGET_BYTES = Math.floor(3.6 * 1024 * 1024);
const MAX_SIDE = 2000;

/** Escala (w, h) para que el lado mayor no pase de `max`, sin agrandar nunca. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type PreparedProof = { ok: true; file: File } | { ok: false; error: string };

const MB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace(".", ",");

async function toJpeg(file: File): Promise<Blob | null> {
  // "from-image" respeta la orientación de la cámara del teléfono.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null; // formato que este navegador no sabe leer
  }
  try {
    let side = MAX_SIDE;
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff"; // los PNG con transparencia no deben quedar en negro
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= TARGET_BYTES) return blob;
      side = Math.round(side * 0.8);
    }
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * Deja el archivo listo para subir:
 *  - PDF: tal cual si cabe; si no, se pide una foto o captura (un PDF no se puede reducir aquí).
 *  - JPG o PNG que ya caben: tal cual.
 *  - Cualquier otra imagen, o una demasiado pesada: se reduce a JPG.
 */
export async function prepareProofFile(file: File): Promise<PreparedProof> {
  if (file.type === "application/pdf") {
    return file.size <= PROOF_LIMIT_BYTES
      ? { ok: true, file }
      : { ok: false, error: `El PDF pesa ${MB(file.size)} MB y el máximo es 4 MB. Sube una foto o una captura del comprobante.` };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Solo se admiten fotos (JPG o PNG) o PDF." };
  }
  if ((file.type === "image/jpeg" || file.type === "image/png") && file.size <= TARGET_BYTES) {
    return { ok: true, file };
  }
  const blob = await toJpeg(file);
  if (!blob) {
    return { ok: false, error: "No pudimos leer o reducir esa imagen. Prueba con una captura en JPG o PNG, o con un PDF." };
  }
  return { ok: true, file: new File([blob], "comprobante.jpg", { type: "image/jpeg" }) };
}
