import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-accent hover:underline">
            Inicio
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden />
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-11 items-center hover:text-accent hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
