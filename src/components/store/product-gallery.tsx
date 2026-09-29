"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImage } from "@/components/store/product-image";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const current = images[selected];

  return (
    <div>
      <ProductImage
        src={current}
        alt={name}
        priority
        sizes="(min-width: 1024px) 40vw, 100vw"
        className="rounded-card border border-line"
      />
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Imágenes del producto">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Ver imagen ${i + 1} de ${images.length}`}
                aria-current={i === selected}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg border bg-soft",
                  i === selected ? "border-accent" : "border-line hover:border-accent/50",
                )}
              >
                <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
