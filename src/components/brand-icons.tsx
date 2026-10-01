import Image from "next/image";
import { siWhatsapp } from "simple-icons";
import facebookIcon from "../../public/brand/facebook-icon.png";
import { cn } from "@/lib/utils";

/**
 * Íconos de marca (los únicos de la tienda que llevan su propio color; el resto usa la paleta).
 *  - Facebook: el archivo entregado por el cliente (`public/brand/facebook.png`), sin recolorear ni
 *    redibujar; solo se le quitó el margen transparente y se redujo a 256 px (`facebook-icon.png`).
 *  - WhatsApp: el glifo oficial de `simple-icons` (CC0) en blanco sobre su verde #25D366, dentro de un
 *    cuadrado con el mismo radio de esquina que el de Facebook (20 % del lado), para que combinen.
 */
export type Brand = "facebook" | "whatsapp";

const LABEL: Record<Brand, string> = { facebook: "Facebook", whatsapp: "WhatsApp" };

export function BrandIcon({ brand, size = 24, className }: { brand: Brand; size?: number; className?: string }) {
  if (brand === "facebook") {
    return (
      <Image
        src={facebookIcon}
        alt={LABEL.facebook}
        width={size}
        height={size}
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={LABEL.whatsapp}
      className={cn("shrink-0", className)}
    >
      <rect width="24" height="24" rx="4.8" fill={`#${siWhatsapp.hex}`} />
      <path d={siWhatsapp.path} fill="#fff" transform="translate(4.5 4.5) scale(0.625)" />
    </svg>
  );
}

/**
 * Enlace a una red social o a un chat: abre en otra pestaña sin dar acceso a esta página, con área
 * táctil de 44 px y el nombre de la marca para lectores de pantalla (`label` lo puede precisar, p. ej.
 * "WhatsApp 099 123 4567" cuando hay dos números).
 */
export function BrandLink({
  brand,
  href,
  label,
  className,
}: {
  brand: Brand;
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label ?? LABEL[brand]}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-150", className)}
    >
      <BrandIcon brand={brand} />
    </a>
  );
}
