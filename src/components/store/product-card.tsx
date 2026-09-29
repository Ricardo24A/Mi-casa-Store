import Link from "next/link";
import { PriceTag } from "@/components/store/price-tag";
import { ProductImage } from "@/components/store/product-image";
import type { StoreProduct } from "@/types/store";

export function ProductCard({ product, priority }: { product: StoreProduct; priority?: boolean }) {
  return (
    <Link
      href={`/producto/${product.slug}`}
      className="lift group block overflow-hidden rounded-card border border-line bg-surface hover:border-accent/50"
    >
      <div className="relative">
        <ProductImage
          src={product.imagenes[0]}
          alt={product.nombre}
          priority={priority}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        {product.descuentoPct !== null && (
          <span className="absolute left-3 top-3 rounded-full bg-sale-ink px-2.5 py-1 text-xs font-semibold text-white">
            -{product.descuentoPct}%
          </span>
        )}
        {product.disponible === 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
            Agotado
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="mb-1 text-[13px] text-ink-soft">{product.subcategoria.nombre}</p>
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-accent">
          {product.nombre}
        </h3>
        <PriceTag product={product} />
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: StoreProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
