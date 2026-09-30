"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { addToCart, useCartItems, useCartReady } from "@/lib/cart-store";

export function AddToCart({ productId, disponible }: { productId: string; disponible: number }) {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const ready = useCartReady();
  const inCart = useCartItems().find((i) => i.productId === productId)?.cantidad ?? 0;

  if (disponible <= 0) {
    return (
      <button type="button" disabled className={buttonClass("primary", "lg", "w-full")}>
        Agotado
      </button>
    );
  }

  const remaining = Math.max(disponible - inCart, 0);
  const max = Math.max(remaining, 1);
  const qty = Math.min(quantity, max);

  const add = () => {
    if (remaining <= 0) return;
    addToCart(productId, qty, disponible);
    setQuantity(1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-line bg-surface" role="group" aria-label="Cantidad">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(qty - 1, 1))}
            disabled={qty <= 1 || remaining <= 0}
            className="inline-flex size-11 items-center justify-center text-ink hover:bg-soft disabled:opacity-40"
            aria-label="Disminuir cantidad"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
            {remaining <= 0 ? 0 : qty}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(Math.min(qty + 1, max))}
            disabled={qty >= max || remaining <= 0}
            className="inline-flex size-11 items-center justify-center text-ink hover:bg-soft disabled:opacity-40"
            aria-label="Aumentar cantidad"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!ready || remaining <= 0}
          className={buttonClass("primary", "lg", "flex-1")}
        >
          {remaining <= 0 ? "Ya tienes todas las unidades" : "Agregar al carrito"}
        </button>
      </div>

      <p className="min-h-5 text-sm text-ink-soft" role="status">
        {justAdded ? (
          <span className="inline-flex items-center gap-1 text-accent">
            <Check className="size-4" aria-hidden /> Agregado.{" "}
            <Link href="/carrito" className="font-semibold underline">
              Ver carrito
            </Link>
          </span>
        ) : inCart > 0 ? (
          `Ya tienes ${inCart} en el carrito.`
        ) : null}
      </p>
    </div>
  );
}
