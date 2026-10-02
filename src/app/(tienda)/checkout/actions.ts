"use server";

import { CHECKOUT_REQUIRES_ACCOUNT } from "@/config/site";
import { getAdminSession } from "@/lib/auth";
import { cartLineStatus, lineNotice } from "@/lib/cart-status";
import { CHECKOUT_GENERIC_ERROR, checkoutErrorFromDb, type CheckoutErrorCode } from "@/lib/checkout-errors";
import { readCartLines } from "@/lib/cart-server";
import { getProductsByIds } from "@/lib/catalog";
import { notifyOrderCreated } from "@/lib/email/notify";
import { computeOrderTotals, shippingToArrange } from "@/lib/order-totals";
import { checkRateLimits } from "@/lib/rate-limit";
import { rateLimitMessage } from "@/lib/rate-limit-core";
import { getCheckoutSettings } from "@/lib/store-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/account";
import { checkoutInputSchema } from "@/lib/validation/checkout";

export type CheckoutResult =
  | { ok: true; referencia: string }
  | {
      ok: false;
      error: string;
      /**
       * `login`: no hay sesión de cliente; la pantalla lleva al login con next=/checkout.
       * `stock`: hay que revisar el carrito. `cuenta`: hay que ver los pedidos en Mi cuenta.
       */
      code?: "login" | CheckoutErrorCode;
      fieldErrors?: Record<string, string>;
    };

const GENERIC_ERROR = CHECKOUT_GENERIC_ERROR;

/**
 * Crea el pedido. La autorización se decide AQUÍ, en el servidor: ocultar el botón no basta.
 *  - Sin sesión de cliente se rechaza (y el pedido se guarda siempre con `user_id = auth.uid()`;
 *    ese id sale de la sesión, nunca del navegador).
 *  - Nombre, teléfono y dirección de envío son obligatorios.
 *  - Precios, descuentos, envío y total se calculan aquí con datos de la base de datos.
 *  - La reserva de stock y la creación del pedido son atómicas (función SQL `create_order`).
 */
export async function crearPedido(input: unknown): Promise<CheckoutResult> {
  // 1) Sesión: solo un cliente con cuenta. (Con CHECKOUT_REQUIRES_ACCOUNT = false se podría
  //    permitir invitados, pero `create_order` también exige usuario: cambiar ambos a la vez.)
  const session = await getAdminSession();
  if (!session.userId || session.role === null) {
    return { ok: false, code: "login", error: "Inicia sesión o crea una cuenta para pagar." };
  }
  if (session.role !== "customer") {
    return { ok: false, error: "Las cuentas de administración no pueden hacer compras." };
  }
  if (!CHECKOUT_REQUIRES_ACCOUNT) {
    // La política actual del negocio es cuenta obligatoria; si se cambia, hay que revisar este flujo.
    return { ok: false, error: GENERIC_ERROR };
  }

  // 2) Entrada
  const parsed = checkoutInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos marcados.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { nombre, telefono, addressId, address } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || user.id !== session.userId) {
    return { ok: false, code: "login", error: "Tu sesión expiró. Inicia sesión de nuevo." };
  }

  // Límite de intentos por usuario. Falla cerrado: sin límite se podría apartar stock en bucle
  // (la base además limita a 3 pedidos pendientes por cuenta).
  const limited = rateLimitMessage(await checkRateLimits([{ rule: "pedido", identity: user.id }], "closed"));
  if (limited) return { ok: false, error: limited };

  // 3) El carrito de la cuenta (base de datos) y sus precios y stock reales
  const items = await readCartLines(supabase, user.id);
  if (items.length === 0) return { ok: false, error: "Tu carrito está vacío." };
  const products = await getProductsByIds([...new Set(items.map((i) => i.productId))]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    // Mismo criterio que el carrito: desactivado, de una categoría desactivada, agotado o por encima
    // del stock. `p` viene de la lectura pública (RLS), así que un producto de una categoría
    // desactivada llega como undefined aunque esté en el carrito de la cuenta.
    const status = cartLineStatus(item.cantidad, p);
    if (status.kind !== "ok" || !p) {
      const name = p ? `“${p.nombre}”: ` : "";
      return { ok: false, code: "stock", error: `${name}${lineNotice(status) ?? "No está disponible."} Revisa tu carrito.` };
    }
    lines.push({ product: p, cantidad: item.cantidad });
  }

  const admin = createAdminClient();
  // Reglas de cobro de Configuración, leídas aquí en el servidor en cada pedido.
  const settings = await getCheckoutSettings();
  if (!settings) return { ok: false, error: GENERIC_ERROR };
  // Sin cuentas bancarias el cliente no sabría dónde transferir: no se crea el pedido ni se aparta stock.
  if (settings.cuentas_bancarias.length === 0) {
    return { ok: false, error: "Por ahora no podemos recibir pedidos en línea. Inténtalo más tarde." };
  }

  const totals = computeOrderTotals(
    lines.map((l) => ({ precio: l.product.precio, precioFinal: l.product.precioFinal, cantidad: l.cantidad })),
    settings,
  );

  // 4) Dirección de envío, ya con el stock comprobado para no guardar una dirección si el pedido
  //    no procede (RLS limita todo a las direcciones del propio usuario)
  let shipping: Record<string, string | null>;
  if (addressId) {
    const { data } = await supabase
      .from("customer_addresses")
      .select("destinatario, telefono, provincia, ciudad, direccion, referencia")
      .eq("id", addressId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) return { ok: false, error: "No encontramos esa dirección.", fieldErrors: { address: "Elige otra dirección" } };
    shipping = data;
  } else {
    const { count } = await supabase
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const row = {
      user_id: user.id,
      etiqueta: address!.etiqueta,
      destinatario: nombre,
      telefono,
      provincia: address!.provincia,
      ciudad: address!.ciudad,
      direccion: address!.direccion,
      referencia: address!.referencia,
      es_predeterminada: (count ?? 0) === 0,
    };
    const { error } = await supabase.from("customer_addresses").insert(row);
    if (error) {
      return {
        ok: false,
        error:
          error.code === "23514"
            ? "Ya tienes 10 direcciones guardadas. Elige una de ellas."
            : "No pudimos guardar la dirección.",
      };
    }
    shipping = {
      destinatario: row.destinatario,
      telefono: row.telefono,
      provincia: row.provincia,
      ciudad: row.ciudad,
      direccion: row.direccion,
      referencia: row.referencia,
    };
  }

  // 5) Nombre y teléfono en el perfil, si aún no estaban
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  const missing: { full_name?: string; phone?: string } = {};
  if (!profile?.full_name) missing.full_name = nombre;
  if (!profile?.phone) missing.phone = telefono;
  if (Object.keys(missing).length > 0) {
    await supabase.from("profiles").update(missing).eq("id", user.id);
  }

  // 6) Pedido atómico. Nombre y precio de cada línea salen de la base, congelados al comprar.
  //    create_order bloquea el carrito y exige que estas líneas sean las suyas: un segundo envío
  //    simultáneo encuentra el carrito vacío y no crea otro pedido.
  const { data, error } = await admin.rpc("create_order", {
    p_user_id: user.id,
    p_nombre: nombre,
    p_email: user.email,
    p_telefono: telefono,
    p_direccion: shipping,
    p_items: lines.map((l) => ({
      product_id: l.product.id,
      nombre: l.product.nombre,
      precio_unitario: l.product.precio,
      cantidad: l.cantidad,
    })),
    p_subtotal: totals.subtotal,
    p_descuento: totals.descuento,
    p_descuento_transferencia: totals.descuento_transferencia,
    p_envio: totals.envio,
    p_total: totals.total,
    p_horas_limite: settings.horas_limite_pago,
  });

  if (error) return { ok: false, ...checkoutErrorFromDb(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.o_referencia) return { ok: false, error: GENERIC_ERROR };

  // El pedido ya está guardado: el correo se programa con after() y nunca puede romper este flujo.
  notifyOrderCreated({
    referencia: row.o_referencia as string,
    items: lines.map((l) => ({ nombre: l.product.nombre, cantidad: l.cantidad, precioUnitario: l.product.precioFinal })),
    subtotal: totals.subtotal,
    descuento: totals.descuento,
    descuentoTransferencia: totals.descuento_transferencia,
    envio: totals.envio,
    envioPorCoordinar: shippingToArrange(settings),
    total: totals.total,
    direccion: {
      destinatario: shipping.destinatario ?? nombre,
      direccion: shipping.direccion ?? "",
      ciudad: shipping.ciudad ?? "",
      provincia: shipping.provincia ?? "",
    },
  });

  return { ok: true, referencia: row.o_referencia as string };
}
