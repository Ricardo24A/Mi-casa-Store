import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
import { ProductGrid } from "@/components/store/product-card";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { getCatalogProducts, getCategoryScope, getCategoryTree } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import {
  SORT_LABELS,
  SORT_OPTIONS,
  parseCatalogQuery,
  type CatalogQuery,
} from "@/lib/validation/catalog-query";
import type { CategoryNode, CategoryScope, StoreProduct } from "@/types/store";

const PAGE_SIZE = 24;

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Arma una URL conservando solo los parámetros válidos ya interpretados. */
function buildHref(basePath: string, query: CatalogQuery, overrides: Partial<CatalogQuery> = {}) {
  const q = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  if (q.orden !== "relevancia") params.set("orden", q.orden);
  if (q.min !== undefined) params.set("min", String(q.min));
  if (q.max !== undefined) params.set("max", String(q.max));
  if (q.pagina > 1) params.set("pagina", String(q.pagina));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function applyQuery(products: StoreProduct[], query: CatalogQuery): StoreProduct[] {
  // El rango y el orden usan el precio final (con descuento), el que paga el cliente.
  let list = products.filter(
    (p) =>
      (query.min === undefined || p.precioFinal >= query.min) &&
      (query.max === undefined || p.precioFinal <= query.max),
  );
  switch (query.orden) {
    case "precio-asc":
      list = list.toSorted((a, b) => a.precioFinal - b.precioFinal);
      break;
    case "precio-desc":
      list = list.toSorted((a, b) => b.precioFinal - a.precioFinal);
      break;
    case "nombre":
      list = list.toSorted((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      break;
    default:
      // "relevancia": el orden que viene de la base (más recientes primero)
      break;
  }
  return list;
}

function scopeTitle(scope: CategoryScope | null, q: string | undefined) {
  if (q) return `Resultados para “${q}”`;
  if (!scope) return "Todos los productos";
  return scope.tipo === "subcategoria" ? scope.subcategoria.nombre : scope.categoria.nombre;
}

function scopeCrumbs(scope: CategoryScope | null): Crumb[] {
  if (!scope) return [{ label: "Productos" }];
  if (scope.tipo === "categoria") return [{ label: scope.categoria.nombre }];
  return [
    { label: scope.categoria.nombre, href: `/categoria/${scope.categoria.slug}` },
    { label: scope.subcategoria.nombre },
  ];
}

function CategoryNav({
  tree,
  scope,
  query,
}: {
  tree: CategoryNode[];
  scope: CategoryScope | null;
  query: CatalogQuery;
}) {
  const activeCategoryId = scope?.categoria.id;
  const activeSubId = scope?.tipo === "subcategoria" ? scope.subcategoria.id : undefined;
  // Al cambiar de categoría se conserva la búsqueda pero se reinicia la página.
  const carry = { pagina: 1 };

  return (
    <nav aria-label="Categorías">
      <h2 className="mb-3 text-sm font-semibold text-ink">Categorías</h2>
      <ul className="space-y-1 text-sm">
        <li>
          <Link
            href={buildHref("/catalogo", query, carry)}
            aria-current={!scope ? "page" : undefined}
            className={cn("flex min-h-11 items-center rounded-md px-2 hover:bg-bg-alt", !scope && "font-semibold text-accent")}
          >
            Todos
          </Link>
        </li>
        {tree.map((cat) => {
          const isActive = cat.id === activeCategoryId;
          return (
            <li key={cat.id}>
              <Link
                href={buildHref(`/categoria/${cat.slug}`, query, carry)}
                aria-current={isActive && !activeSubId ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-2 hover:bg-bg-alt",
                  isActive && !activeSubId && "font-semibold text-accent",
                )}
              >
                {cat.nombre}
              </Link>
              {isActive && (
                <ul className="mb-1 ml-3 border-l border-line pl-2">
                  {cat.subcategorias.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={buildHref(`/categoria/${sub.slug}`, query, carry)}
                        aria-current={sub.id === activeSubId ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center rounded-md px-2 text-ink-soft hover:bg-bg-alt hover:text-ink",
                          sub.id === activeSubId && "font-semibold text-accent",
                        )}
                      >
                        {sub.nombre}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Orden y rango de precio. Formulario GET: funciona sin JavaScript. */
function Filters({ basePath, query }: { basePath: string; query: CatalogQuery }) {
  const field =
    "min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
  return (
    <form action={basePath} method="get" className="space-y-4">
      {query.q && <input type="hidden" name="q" value={query.q} />}
      <div>
        <label htmlFor="orden" className="mb-1 block text-sm font-semibold text-ink">
          Ordenar por
        </label>
        <select id="orden" name="orden" defaultValue={query.orden} className={field}>
          {SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {SORT_LABELS[o]}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Precio (USD)</legend>
        <div className="flex items-center gap-2">
          <label htmlFor="min" className="sr-only">
            Precio mínimo
          </label>
          <input id="min" name="min" type="number" inputMode="decimal" min={0} step="0.01" placeholder="Mín." defaultValue={query.min} className={field} />
          <span aria-hidden className="text-ink-soft">
            –
          </span>
          <label htmlFor="max" className="sr-only">
            Precio máximo
          </label>
          <input id="max" name="max" type="number" inputMode="decimal" min={0} step="0.01" placeholder="Máx." defaultValue={query.max} className={field} />
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary", "sm", "flex-1")}>
          Aplicar
        </button>
        <Link href={query.q ? `${basePath}?q=${encodeURIComponent(query.q)}` : basePath} className={buttonClass("secondary", "sm")}>
          Limpiar
        </Link>
      </div>
    </form>
  );
}

function Pagination({
  basePath,
  query,
  totalPages,
}: {
  basePath: string;
  query: CatalogQuery;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-4">
      {query.pagina > 1 ? (
        <Link href={buildHref(basePath, query, { pagina: query.pagina - 1 })} className={buttonClass("secondary", "sm")} rel="prev">
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-soft">
        Página {query.pagina} de {totalPages}
      </p>
      {query.pagina < totalPages ? (
        <Link href={buildHref(basePath, query, { pagina: query.pagina + 1 })} className={buttonClass("secondary", "sm")} rel="next">
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * Catálogo (todo, una categoría o una subcategoría). Lee `searchParams`, así que se debe
 * renderizar dentro de <Suspense> (la lectura de datos sí está en caché).
 * Si el slug no es de una categoría visible, 404.
 */
export async function CatalogView({
  scopeSlug,
  searchParams,
}: {
  scopeSlug?: string;
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseCatalogQuery(await searchParams);

  let scope: CategoryScope | null = null;
  if (scopeSlug) {
    scope = await getCategoryScope(scopeSlug);
    if (!scope) notFound();
  }

  const [tree, matches] = await Promise.all([
    getCategoryTree(),
    getCatalogProducts({ scopeSlug, q: query.q }),
  ]);

  const products = applyQuery(matches, query);
  const totalPages = Math.max(Math.ceil(products.length / PAGE_SIZE), 1);
  const page = Math.min(query.pagina, totalPages);
  const pageQuery = { ...query, pagina: page };
  const visible = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const basePath = scopeSlug ? `/categoria/${scopeSlug}` : "/catalogo";
  const hasFilters = query.min !== undefined || query.max !== undefined;

  return (
    <Container className="py-8">
      <Breadcrumbs items={scopeCrumbs(scope)} />
      <div className="mt-3 mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{scopeTitle(scope, query.q)}</h1>
        <p className="text-sm text-ink-soft" aria-live="polite">
          {products.length} {products.length === 1 ? "producto" : "productos"}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-6">
          <details className="group rounded-card border border-line bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              Categorías y filtros
            </summary>
            <div className="space-y-6 border-t border-line p-4">
              <CategoryNav tree={tree} scope={scope} query={pageQuery} />
              <Filters basePath={basePath} query={query} />
            </div>
          </details>
          <div className="hidden space-y-8 lg:block">
            <CategoryNav tree={tree} scope={scope} query={pageQuery} />
            <Filters basePath={basePath} query={query} />
          </div>
        </aside>

        <section aria-label="Productos">
          {visible.length > 0 ? (
            <>
              <ProductGrid products={visible} />
              <Pagination basePath={basePath} query={pageQuery} totalPages={totalPages} />
            </>
          ) : (
            <EmptyState
              icon={<PackageSearch className="size-8" aria-hidden />}
              title="No encontramos productos"
              action={
                (query.q || hasFilters) && (
                  <Link href={basePath} className={buttonClass("secondary")}>
                    Quitar búsqueda y filtros
                  </Link>
                )
              }
            >
              {query.q || hasFilters
                ? "Prueba con otra búsqueda o con un rango de precio distinto."
                : "Todavía no hay productos en esta sección."}
            </EmptyState>
          )}
        </section>
      </div>
    </Container>
  );
}

export function CatalogSkeleton() {
  return (
    <Container className="py-8" aria-busy="true">
      <div className="mb-6 h-9 w-56 animate-pulse rounded-lg bg-bg-alt" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-card bg-bg-alt" />
        ))}
      </div>
    </Container>
  );
}
