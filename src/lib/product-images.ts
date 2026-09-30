import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkImageBytes, PRODUCT_IMAGE_MAX_BYTES } from "@/lib/validation/files";

export const PRODUCT_IMAGES_BUCKET = "product-images";
/** Máximo de imágenes por producto. */
export const MAX_PRODUCT_IMAGES = 8;

export type StoredImage = { ok: true; path: string } | { ok: false; error: string };

/**
 * Valida (tamaño y tipo REAL por los primeros bytes) y guarda una imagen en el bucket público
 * `product-images`, con un nombre generado aquí. Se sube con la sesión del administrador
 * (`supabase` = cliente con sus cookies): las políticas del bucket solo dejan escribir al admin con 2FA.
 * Devuelve la ruta dentro del bucket (lo que se guarda en la base de datos).
 */
export async function storeImage(supabase: SupabaseClient, folder: string, file: File): Promise<StoredImage> {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return { ok: false, error: "La imagen pesa más de 4 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImageBytes(bytes);
  if (!check.ok) return check;

  const path = `${folder}/${randomUUID()}.${check.extension}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: check.mime, upsert: false });
  if (error) return { ok: false, error: "No pudimos guardar la imagen. Inténtalo de nuevo." };
  return { ok: true, path };
}

/** Borra archivos del bucket. No falla: un archivo suelto solo ocupa espacio. */
export async function removeImages(supabase: SupabaseClient, paths: string[]) {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return;
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(clean);
}
