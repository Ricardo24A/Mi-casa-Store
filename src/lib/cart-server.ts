import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAdminSession, getAdminSessionUncached } from "@/lib/auth";
import type { CartApiResult } from "@/lib/cart-core";
import { itemSchema, type CartItem } from "@/lib/cart-logic";
import { createClient } from "@/lib/supabase/server";

/** Líneas del carrito de la cuenta, en el orden en que se agregaron. RLS ya limita a las propias. */
export async function readCartLines(supabase: SupabaseClient, userId: string): Promise<CartItem[]> {
  const { data } = await supabase
    .from("cart_items")
    .select("product_id, cantidad")
    .eq("user_id", userId)
    .order("created_at")
    .order("product_id");
  const lines: CartItem[] = [];
  for (const row of data ?? []) {
    const parsed = itemSchema.safeParse({ productId: row.product_id, cantidad: row.cantidad });
    if (parsed.success) lines.push(parsed.data);
  }
  return lines;
}

/** Carrito de la sesión actual (para el layout de la tienda). Solo clientes; el resto, invitado. */
export async function getSessionCart(): Promise<{ userId: string | null; items: CartItem[] }> {
  // Lectura propia (sin la deduplicación de cache()): la usa CartOwner en el layout de la tienda,
  // dentro de su <Suspense>, y no debe compartir la espera con la página.
  const session = await getAdminSessionUncached();
  if (!session.userId || session.role !== "customer") return { userId: null, items: [] };
  const supabase = await createClient();
  return { userId: session.userId, items: await readCartLines(supabase, session.userId) };
}

export interface CartContext {
  userId: string;
  supabase: SupabaseClient;
}

/**
 * Sesión para una acción del carrito. Solo un cliente con sesión, y solo si es el usuario que la
 * pantalla cree tener (`expectedUserId`): si otra pestaña cambió de cuenta, no se toca nada y se
 * devuelve el carrito de la sesión real. El usuario sale SIEMPRE de la sesión, nunca del navegador.
 */
export async function cartContext(expectedUserId: unknown): Promise<CartContext | CartApiResult> {
  const expected = z.uuid().safeParse(expectedUserId);
  if (!expected.success) return { ok: false, code: "error", error: "Solicitud inválida." };

  const session = await getAdminSession();
  if (!session.userId || session.role !== "customer") return { ok: false, code: "login" };

  const supabase = await createClient();
  if (session.userId !== expected.data) {
    return { ok: false, code: "session", userId: session.userId, items: await readCartLines(supabase, session.userId) };
  }
  return { userId: session.userId, supabase };
}

export const isContext = (r: CartContext | CartApiResult): r is CartContext => "supabase" in r;

/** Respuesta correcta: el carrito completo de la cuenta tal como quedó en la base de datos. */
export async function cartOk(ctx: CartContext): Promise<CartApiResult> {
  return { ok: true, userId: ctx.userId, items: await readCartLines(ctx.supabase, ctx.userId) };
}
