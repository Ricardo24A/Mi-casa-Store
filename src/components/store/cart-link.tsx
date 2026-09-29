"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartItems } from "@/lib/cart-store";

export function CartLink() {
  const count = useCartItems().reduce((sum, i) => sum + i.cantidad, 0);
  return (
    <Link
      href="/carrito"
      className="relative inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-bg-alt"
      aria-label={count > 0 ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito"}
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
