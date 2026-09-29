import { Search } from "lucide-react";
import { Q_MAX_LENGTH } from "@/lib/validation/catalog-query";

/** Buscador. Formulario GET normal: funciona sin JavaScript. */
export function SearchForm({ className }: { className?: string }) {
  return (
    <form action="/catalogo" method="get" role="search" className={className}>
      <label htmlFor="buscar" className="sr-only">
        Buscar productos
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          id="buscar"
          name="q"
          type="search"
          maxLength={Q_MAX_LENGTH}
          placeholder="Buscar productos"
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
        />
      </div>
    </form>
  );
}
