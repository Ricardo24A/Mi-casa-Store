"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ShoppingBag } from "lucide-react";
import { fetchCartProducts } from "@/app/(tienda)/carrito/actions";
import { crearPedido, type CheckoutResult } from "@/app/(tienda)/checkout/actions";
import { ProductImage } from "@/components/store/product-image";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormError, SelectField } from "@/components/ui/form-controls";
import { PROVINCIAS } from "@/config/ecuador";
import { resetCartAfterOrder, useCartItems, useCartReady } from "@/lib/cart-store";
import { formatUsd } from "@/lib/format";
import { blocksCheckout, cartLineStatus } from "@/lib/cart-status";
import { computeOrderTotals, shippingToArrange, type TotalsSettings } from "@/lib/order-totals";
import type { StoreProduct } from "@/types/store";

export interface SavedAddress {
  id: string;
  etiqueta: string;
  destinatario: string;
  telefono: string;
  provincia: string;
  ciudad: string;
  direccion: string;
  referencia: string | null;
  es_predeterminada: boolean;
}

type Loaded = { key: string; products: StoreProduct[] } | { key: string; error: true };
const NEW_ADDRESS = "nueva";

export function CheckoutView({
  fullName,
  phone,
  addresses,
  settings,
  canPay,
}: {
  fullName: string;
  phone: string;
  addresses: SavedAddress[];
  settings: TotalsSettings;
  /** El negocio ya registró al menos una cuenta para recibir la transferencia. */
  canPay: boolean;
}) {
  const router = useRouter();
  const items = useCartItems();
  const ready = useCartReady();
  const key = items.map((i) => `${i.productId}:${i.cantidad}`).join(",");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState(
    addresses.find((a) => a.es_predeterminada)?.id ?? addresses[0]?.id ?? NEW_ADDRESS,
  );
  const [result, setResult] = useState<Extract<CheckoutResult, { ok: false }> | null>(null);
  const [pending, startTransition] = useTransition();

  // Precio y stock siempre desde la base de datos; el navegador solo aporta IDs y cantidades.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchCartProducts(items).then(
      (res) => {
        if (!cancelled) setLoaded(res.ok ? { key, products: res.products } : { key, error: true });
      },
      () => {
        if (!cancelled) setLoaded({ key, error: true });
      },
    );
    return () => {
      cancelled = true;
    };
    // `items` cambia de referencia con cada render del almacén; `key` resume su contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Hasta saber de quién es el carrito no se muestra nada (ni el carrito vacío).
  if (!ready) return <div className="h-64 animate-pulse rounded-card bg-bg-alt" aria-busy="true" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-8" aria-hidden />}
        title="Tu carrito está vacío"
        action={
          <Link href="/catalogo" className={buttonClass("primary")}>
            Ver productos
          </Link>
        }
      >
        Agrega productos para comenzar tu compra.
      </EmptyState>
    );
  }

  const current = loaded && loaded.key === key ? loaded : null;
  if (!current) return <div className="h-64 animate-pulse rounded-card bg-bg-alt" aria-busy="true" />;
  if ("error" in current) {
    return <EmptyState title="No pudimos cargar tu pedido">Revisa tu conexión e inténtalo de nuevo.</EmptyState>;
  }

  const byId = new Map(current.products.map((p) => [p.id, p]));
  const lines = items.flatMap((item) => {
    const product = byId.get(item.productId);
    return product ? [{ product, cantidad: item.cantidad }] : [];
  });
  const unavailable = items.some((i) => blocksCheckout(cartLineStatus(i.cantidad, byId.get(i.productId))));
  const totals = computeOrderTotals(
    lines.map((l) => ({ precio: l.product.precio, precioFinal: l.product.precioFinal, cantidad: l.cantidad })),
    settings,
  );
  const e = result?.fieldErrors ?? {};
  const useNew = selected === NEW_ADDRESS;

  function submit(formData: FormData) {
    const text = (name: string) => String(formData.get(name) ?? "");
    setResult(null);
    startTransition(async () => {
      const res = await crearPedido({
        nombre: text("nombre"),
        telefono: text("telefono"),
        ...(useNew
          ? {
              address: {
                etiqueta: text("etiqueta"),
                provincia: text("provincia"),
                ciudad: text("ciudad"),
                direccion: text("direccion"),
                referencia: text("referencia"),
              },
            }
          : { addressId: selected }),
      });
      if (res.ok) {
        resetCartAfterOrder();
        router.push(`/confirmacion/${res.referencia}`);
        return;
      }
      // Sin sesión (venció): al login, y el carrito sigue en el navegador.
      if (res.code === "login") {
        router.push("/login?next=%2Fcheckout");
        return;
      }
      setResult(res);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={submit} className="space-y-8" noValidate>
        <section aria-labelledby="contacto" className="space-y-4">
          <h2 id="contacto" className="text-xl font-semibold text-ink">Tus datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" name="nombre" autoComplete="name" required defaultValue={fullName} error={e.nombre} />
            <Field label="Teléfono" name="telefono" type="tel" autoComplete="tel" required defaultValue={phone} error={e.telefono} />
          </div>
        </section>

        <section aria-labelledby="envio" className="space-y-4">
          <h2 id="envio" className="text-xl font-semibold text-ink">Dirección de envío</h2>

          {addresses.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Elige una dirección</legend>
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer gap-3 rounded-card border border-line bg-surface p-4 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                >
                  <input
                    type="radio"
                    name="address-choice"
                    checked={selected === a.id}
                    onChange={() => setSelected(a.id)}
                    className="mt-1 size-5 accent-accent"
                  />
                  <span className="text-sm text-ink-soft">
                    <span className="block font-semibold text-ink">{a.etiqueta}</span>
                    {a.direccion}, {a.ciudad}, {a.provincia}
                    {a.referencia ? ` · ${a.referencia}` : ""}
                  </span>
                </label>
              ))}
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-card border border-line bg-surface p-4 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input
                  type="radio"
                  name="address-choice"
                  checked={useNew}
                  onChange={() => setSelected(NEW_ADDRESS)}
                  className="size-5 accent-accent"
                />
                <span className="text-sm font-semibold text-ink">Usar una dirección nueva</span>
              </label>
            </fieldset>
          )}

          {useNew && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Provincia" name="provincia" required error={e.provincia}>
                <option value="">Elige una provincia</option>
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </SelectField>
              <Field label="Ciudad" name="ciudad" required error={e.ciudad} />
              <Field className="sm:col-span-2" label="Dirección" name="direccion" autoComplete="street-address" required error={e.direccion} hint="Calle principal, número y calle secundaria." />
              <Field className="sm:col-span-2" label="Referencia (opcional)" name="referencia" error={e.referencia} hint="Por ejemplo: junto al parque, casa blanca de dos pisos." />
              <Field label="Nombre de la dirección (opcional)" name="etiqueta" placeholder="Casa, Trabajo…" error={e.etiqueta} />
              <p className="self-end text-sm text-ink-soft">Se guardará en tu cuenta para la próxima vez.</p>
            </div>
          )}
          {e.address && <p className="text-sm text-sale-ink">{e.address}</p>}
        </section>

        <div className="space-y-3">
          <FormError>{result?.error}</FormError>
          {result?.code === "stock" && (
            <Link href="/carrito" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
              Revisar mi carrito
            </Link>
          )}
          <button type="submit" disabled={pending || unavailable || !canPay} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
            {pending ? "Creando pedido…" : "Confirmar pedido"}
          </button>
          {!canPay && (
            <p role="alert" className="text-sm text-sale-ink">
              Por ahora no podemos recibir pedidos en línea. Inténtalo más tarde.
            </p>
          )}
          {unavailable && (
            <p className="text-sm text-sale-ink">
              Hay productos sin stock suficiente.{" "}
              <Link href="/carrito" className="font-semibold underline">
                Revisa tu carrito
              </Link>
              .
            </p>
          )}
        </div>
      </form>

      <aside className="h-fit rounded-card border border-line bg-surface p-5 lg:sticky lg:top-32">
        <h2 className="text-lg font-semibold text-ink">Resumen</h2>
        <ul className="mt-4 space-y-3">
          {lines.map(({ product, cantidad }) => (
            <li key={product.id} className="flex gap-3">
              <div className="w-14 shrink-0 overflow-hidden rounded-lg border border-line">
                <ProductImage src={product.imagenes[0]} alt="" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2 font-semibold text-ink">{product.nombre}</p>
                <p className="text-ink-soft">
                  {cantidad} × {formatUsd(product.precioFinal)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <Row label="Subtotal" value={formatUsd(totals.subtotal)} />
          {totals.descuento > 0 && <Row label="Descuentos" value={`−${formatUsd(totals.descuento)}`} />}
          {totals.descuento_transferencia > 0 && (
            <Row label="Descuento por transferencia" value={`−${formatUsd(totals.descuento_transferencia)}`} />
          )}
          <Row label="Envío" value={shippingToArrange(settings) ? "A coordinar" : totals.envio === 0 ? "Gratis" : formatUsd(totals.envio)} />
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-semibold text-ink">Total</dt>
            <dd className="text-lg font-semibold text-ink">{formatUsd(totals.total)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-ink-soft">
          El pago es por transferencia bancaria. Verás las cuentas y tu código de referencia al confirmar el pedido.
        </p>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
