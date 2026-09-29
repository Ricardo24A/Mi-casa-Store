"use server";

import { z } from "zod";
import { getProductsByIds } from "@/lib/catalog";
import type { StoreProduct } from "@/types/store";

const inputSchema = z
  .array(z.object({ productId: z.uuid(), cantidad: z.number().int().min(1).max(100) }))
  .max(50);

export type CartProductsResult = { ok: true; products: StoreProduct[] } | { ok: false };

/**
 * Datos actuales (precio con descuento y stock) de los productos del carrito. Es solo lectura
 * y solo devuelve productos activos. El navegador no aporta ningún precio.
 */
export async function fetchCartProducts(input: unknown): Promise<CartProductsResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ids = [...new Set(parsed.data.map((i) => i.productId))];
  try {
    return { ok: true, products: await getProductsByIds(ids) };
  } catch {
    return { ok: false };
  }
}
