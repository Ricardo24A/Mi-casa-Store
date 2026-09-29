"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { fetchCartProducts } from "@/app/(tienda)/carrito/actions";
import { PriceTag } from "@/components/store/price-tag";
import { ProductImage } from "@/components/store/product-image";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { removeFromCart, setCartQuantity, useCartItems } from "@/lib/cart-store";
import { fromCents, toCents } from "@/lib/pricing";
import { formatUsd } from "@/lib/format";
import type { StoreProduct } from "@/types/store";

type Loaded = { key: string; products: StoreProduct[] } | { key: string; error: true };

export function CartView() {
  const items = useCartItems();
  const key = items.map((i) => i.productId).join(",");
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Precio y stock siempre desde la base de datos; el navegador solo aporta IDs y cantidades.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchCartProducts(items).then(
      (res) => {
        if (cancelled) return;
        setLoaded(res.ok ? { key, products: res.products } : { key, error: true });
      },
      () => {
        if (!cancelled) setLoaded({ key, error: true });
      },
    );
    return () => {
      cancelled = true;
    };
    // `items` cambia de referencia con cada cantidad; los precios solo dependen de los IDs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items.length === 0) {
    return (
      <Container className="py-12">
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
      </Container>
    );
  }

  const current = loaded && loaded.key === key ? loaded : null;

  if (!current) {
    return (
      <Container className="py-8" aria-busy="true">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight text-ink">Tu carrito</h1>
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.productId} className="h-28 animate-pulse rounded-card bg-bg-alt" />
          ))}
        </div>
      </Container>
    );
  }

  if ("error" in current) {
    return (
      <Container className="py-12">
        <EmptyState title="No pudimos cargar tu carrito">
          Revisa tu conexión e inténtalo de nuevo en un momento.
        </EmptyState>
      </Container>
    );
  }

  const byId = new Map(current.products.map((p) => [p.id, p]));
  let subtotalCents = 0;
  for (const item of items) {
    const p = byId.get(item.productId);
    if (!p) continue;
    subtotalCents += toCents(p.precioFinal) * Math.min(item.cantidad, p.disponible);
  }
  const canCheckout = items.every((i) => {
    const p = byId.get(i.productId);
    return p && p.disponible >= i.cantidad;
  });

  return (
    <Container className="py-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-ink">Tu carrito</h1>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="space-y-3">
          {items.map((item) => {
            const p = byId.get(item.productId);
            if (!p) {
              return (
                <li key={item.productId} className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4">
                  <p className="text-sm text-ink-soft">Este producto ya no está disponible.</p>
                  <button type="button" onClick={() => removeFromCart(item.productId)} className={buttonClass("secondary", "sm")}>
                    Quitar
                  </button>
                </li>
              );
            }
            const over = item.cantidad > p.disponible;
            return (
              <li key={item.productId} className="flex gap-4 rounded-card border border-line bg-surface p-4">
                <Link href={`/producto/${p.slug}`} className="block w-24 shrink-0 self-start overflow-hidden rounded-lg border border-line">
                  <ProductImage src={p.imagenes[0]} alt={p.nombre} sizes="96px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/producto/${p.slug}`} className="-my-3 line-clamp-2 block py-3 text-sm font-semibold text-ink hover:text-accent">
                    {p.nombre}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">{p.subcategoria.nombre}</p>
                  <div className="mt-2">
                    <PriceTag product={p} />
                  </div>

                  {over && (
                    <p className="mt-2 text-sm text-sale-ink" role="alert">
                      {p.disponible === 0
                        ? "Agotado. Quítalo para continuar."
                        : `Solo quedan ${p.disponible}. Reduce la cantidad para continuar.`}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-lg border border-line" role="group" aria-label={`Cantidad de ${p.nombre}`}>
                      <button
                        type="button"
                        onClick={() => setCartQuantity(p.id, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                        className="inline-flex size-11 items-center justify-center hover:bg-soft disabled:opacity-40"
                        aria-label="Disminuir cantidad"
                      >
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <span className="w-9 text-center text-sm font-semibold">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => setCartQuantity(p.id, item.cantidad + 1)}
                        disabled={item.cantidad >= p.disponible}
                        className="inline-flex size-11 items-center justify-center hover:bg-soft disabled:opacity-40"
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-ink">
                        {formatUsd(fromCents(toCents(p.precioFinal) * item.cantidad))}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(p.id)}
                        className="inline-flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-bg-alt hover:text-sale-ink"
                        aria-label={`Quitar ${p.nombre}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit rounded-card border border-line bg-surface p-5 lg:sticky lg:top-32">
          <h2 className="text-lg font-semibold text-ink">Resumen</h2>
          <dl className="mt-4 flex items-baseline justify-between">
            <dt className="text-sm text-ink-soft">Subtotal</dt>
            <dd className="text-lg font-semibold text-ink">{formatUsd(fromCents(subtotalCents))}</dd>
          </dl>
          <p className="mt-3 text-xs text-ink-soft">
            El costo de envío se confirma al finalizar la compra. El pago es por transferencia bancaria y
            se confirma subiendo el comprobante.
          </p>
          <button type="button" disabled className={buttonClass("primary", "lg", "mt-5 w-full")} aria-describedby="checkout-note">
            Finalizar compra
          </button>
          <p id="checkout-note" className="mt-2 text-center text-xs text-ink-soft">
            {canCheckout ? "El pago se habilitará próximamente." : "Revisa los productos marcados para continuar."}
          </p>
          <Link href="/catalogo" className="mt-4 flex min-h-11 items-center justify-center text-sm font-semibold text-accent hover:underline">
            Seguir comprando
          </Link>
        </aside>
      </div>
    </Container>
  );
}
