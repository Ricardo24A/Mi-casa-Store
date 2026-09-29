import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/types/store";

export function PriceTag({
  product,
  size = "md",
}: {
  product: Pick<StoreProduct, "precio" | "precioFinal" | "descuentoPct">;
  size?: "md" | "lg";
}) {
  const discounted = product.descuentoPct !== null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("font-semibold text-accent", size === "lg" ? "text-2xl" : "text-base")}>
        {formatUsd(product.precioFinal)}
      </span>
      {discounted && (
        <>
          <span className={cn("text-ink-soft line-through", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">Precio anterior </span>
            {formatUsd(product.precio)}
          </span>
        </>
      )}
    </div>
  );
}
