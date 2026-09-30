"use server";

import { z } from "zod";
import { cartSchema, MAX_QUANTITY, mergeCartLines, type Availability } from "@/lib/cart-logic";
import type { CartApiResult } from "@/lib/cart-core";
import { cartContext, cartOk, isContext, readCartLines } from "@/lib/cart-server";
import { getProductsByIds } from "@/lib/catalog";
import type { StoreProduct } from "@/types/store";

const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY);
const lineSchema = z.object({ productId: z.uuid(), cantidad: quantitySchema });

const invalid: CartApiResult = { ok: false, code: "error", error: "Solicitud inválida." };
const LIMIT_ERROR = "Tu carrito puede tener hasta 50 productos distintos.";

export type CartProductsResult = { ok: true; products: StoreProduct[] } | { ok: false };

/**
 * Datos actuales (precio con descuento y stock) de los productos del carrito. Es solo lectura
 * y solo devuelve productos activos. El navegador no aporta ningún precio.
 */
export async function fetchCartProducts(input: unknown): Promise<CartProductsResult> {
  const parsed = z.array(lineSchema).max(50).safeParse(input);
  if (!parsed.success) return { ok: false };
  const ids = [...new Set(parsed.data.map((i) => i.productId))];
  try {
    return { ok: true, products: await getProductsByIds(ids) };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Carrito de la cuenta (base de datos). Todas exigen sesión de cliente y devuelven el carrito
// completo tal como quedó. Nunca reciben ni guardan precios: solo producto y cantidad.
// ---------------------------------------------------------------------------

export async function obtenerCarrito(expectedUserId: unknown): Promise<CartApiResult> {
  const ctx = await cartContext(expectedUserId);
  return isContext(ctx) ? cartOk(ctx) : ctx;
}

/** Suma unidades a un producto, sin pasar del stock ni del máximo por línea. */
export async function agregarLinea(expectedUserId: unknown, productId: unknown, cantidad: unknown): Promise<CartApiResult> {
  const line = lineSchema.safeParse({ productId, cantidad });
  if (!line.success) return invalid;
  const ctx = await cartContext(expectedUserId);
  if (!isContext(ctx)) return ctx;

  const [product] = await getProductsByIds([line.data.productId]);
  if (!product) return { ok: false, code: "error", error: "Ese producto ya no está disponible." };
  if (product.disponible <= 0) return { ok: false, code: "error", error: "Ese producto está agotado." };

  const { data: existing } = await ctx.supabase
    .from("cart_items")
    .select("cantidad")
    .eq("user_id", ctx.userId)
    .eq("product_id", line.data.productId)
    .maybeSingle();
  const current = existing?.cantidad ?? 0;
  const next = Math.min(current + line.data.cantidad, MAX_QUANTITY, product.disponible);

  if (next !== current) {
    const { error } = await ctx.supabase
      .from("cart_items")
      .upsert({ user_id: ctx.userId, product_id: line.data.productId, cantidad: next }, { onConflict: "user_id,product_id" });
    if (error) {
      return { ok: false, code: "error", error: error.code === "23514" ? LIMIT_ERROR : "No pudimos actualizar tu carrito." };
    }
  }
  return cartOk(ctx);
}

/** Fija la cantidad de una línea. Un producto agotado o inactivo solo puede bajar, no subir. */
export async function fijarCantidad(expectedUserId: unknown, productId: unknown, cantidad: unknown): Promise<CartApiResult> {
  const line = lineSchema.safeParse({ productId, cantidad });
  if (!line.success) return invalid;
  const ctx = await cartContext(expectedUserId);
  if (!isContext(ctx)) return ctx;

  const { data: existing } = await ctx.supabase
    .from("cart_items")
    .select("cantidad")
    .eq("user_id", ctx.userId)
    .eq("product_id", line.data.productId)
    .maybeSingle();
  if (!existing) return cartOk(ctx);

  const [product] = await getProductsByIds([line.data.productId]);
  const cap = product && product.disponible > 0 ? Math.min(MAX_QUANTITY, product.disponible) : existing.cantidad;
  const next = Math.min(line.data.cantidad, cap);

  if (next !== existing.cantidad) {
    const { error } = await ctx.supabase
      .from("cart_items")
      .update({ cantidad: next })
      .eq("user_id", ctx.userId)
      .eq("product_id", line.data.productId);
    if (error) return { ok: false, code: "error", error: "No pudimos actualizar tu carrito." };
  }
  return cartOk(ctx);
}

export async function quitarLinea(expectedUserId: unknown, productId: unknown): Promise<CartApiResult> {
  const id = z.uuid().safeParse(productId);
  if (!id.success) return invalid;
  const ctx = await cartContext(expectedUserId);
  if (!isContext(ctx)) return ctx;
  const { error } = await ctx.supabase.from("cart_items").delete().eq("user_id", ctx.userId).eq("product_id", id.data);
  if (error) return { ok: false, code: "error", error: "No pudimos actualizar tu carrito." };
  return cartOk(ctx);
}

/** El usuario vacía su carrito. (Cerrar sesión NO llama a esto: no borra nada del servidor.) */
export async function vaciarCarrito(expectedUserId: unknown): Promise<CartApiResult> {
  const ctx = await cartContext(expectedUserId);
  if (!isContext(ctx)) return ctx;
  const { error } = await ctx.supabase.from("cart_items").delete().eq("user_id", ctx.userId);
  if (error) return { ok: false, code: "error", error: "No pudimos actualizar tu carrito." };
  return cartOk(ctx);
}

/**
 * Al iniciar sesión o registrarse: fusiona el carrito local del invitado con el de la cuenta.
 * Suma los repetidos y limita por stock y por el máximo por línea (ver `mergeCartLines`).
 */
export async function fusionarCarrito(expectedUserId: unknown, local: unknown): Promise<CartApiResult> {
  const parsed = cartSchema.safeParse(local);
  if (!parsed.success) return invalid;
  const ctx = await cartContext(expectedUserId);
  if (!isContext(ctx)) return ctx;

  const server = await readCartLines(ctx.supabase, ctx.userId);
  const ids = [...new Set([...server, ...parsed.data].map((i) => i.productId))];
  const products = ids.length > 0 ? await getProductsByIds(ids) : [];
  const availability: Availability = new Map(
    ids.map((id) => {
      const p = products.find((x) => x.id === id);
      return [id, p ? { disponible: p.disponible } : null] as const;
    }),
  );

  const merged = mergeCartLines(server, parsed.data, availability);
  if (merged.length > 0) {
    const { error } = await ctx.supabase.from("cart_items").upsert(
      merged.map((l) => ({ user_id: ctx.userId, product_id: l.productId, cantidad: l.cantidad })),
      { onConflict: "user_id,product_id" },
    );
    if (error) return { ok: false, code: "error", error: "No pudimos fusionar tu carrito." };
  }
  return cartOk(ctx);
}
