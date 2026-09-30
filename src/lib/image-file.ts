// Preparación de imágenes de productos y categorías en el NAVEGADOR: se reducen a un máximo de
// 1600 px y se guardan como WebP (o JPEG si el navegador no sabe) para no pasar de los 4 MB de
// Vercel y para que la tienda cargue rápido. Es comodidad: el servidor vuelve a validar tamaño y
// tipo real del archivo.

import { fitWithin } from "./proof-file.ts";

export const IMAGE_LIMIT_BYTES = 4 * 1024 * 1024;
const TARGET_BYTES = Math.floor(3.6 * 1024 * 1024);
const MAX_SIDE = 1600;
/** Una imagen que ya es pequeña (peso y lados) se sube tal cual, sin volver a comprimirla. */
const KEEP_BYTES = 1024 * 1024;

export type PreparedImage = { ok: true; file: File } | { ok: false; error: string };

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "Solo se admiten imágenes (JPG, PNG o WebP)." };

  let bitmap: ImageBitmap;
  try {
    // "from-image" respeta la orientación de la cámara del teléfono.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, error: "No pudimos leer esa imagen. Prueba con un JPG, PNG o WebP." };
  }

  try {
    const small = Math.max(bitmap.width, bitmap.height) <= MAX_SIDE;
    if (ACCEPTED.has(file.type) && small && file.size <= KEEP_BYTES) return { ok: true, file };

    let side = MAX_SIDE;
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, width, height);

      // WebP si el navegador lo codifica; si no, el resultado llega como PNG y se usa JPEG.
      let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob || blob.type !== "image/webp") {
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      }
      if (blob && blob.size <= TARGET_BYTES) {
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        return { ok: true, file: new File([blob], `imagen.${ext}`, { type: blob.type }) };
      }
      side = Math.round(side * 0.8);
    }
    return { ok: false, error: "No pudimos reducir esa imagen a menos de 4 MB. Prueba con otra." };
  } finally {
    bitmap.close();
  }
}
