import {
  Armchair,
  BedDouble,
  Bath,
  CookingPot,
  House,
  Plug,
  Smartphone,
  TreePine,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Un icono de lucide por categoría de primer nivel (slugs de la semilla). */
const ICONS: Record<string, LucideIcon> = {
  electrodomesticos: Plug,
  tecnologia: Smartphone,
  bano: Bath,
  dormitorio: BedDouble,
  comedor: Utensils,
  cocina: CookingPot,
  exteriores: TreePine,
  decoracion: Armchair,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? House;
  return <Icon className={cn("size-6", className)} strokeWidth={1.75} aria-hidden />;
}
