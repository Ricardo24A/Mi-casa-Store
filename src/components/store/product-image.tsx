import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Imagen de producto con proporción fija 1:1. Sin imagen, un fondo neutro con icono. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-soft", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-ink-soft/60">
          <ImageOff className="size-8" aria-label="Sin imagen" role="img" />
        </div>
      )}
    </div>
  );
}
