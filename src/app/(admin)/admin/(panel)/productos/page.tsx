import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, Package, Pencil, Plus } from "lucide-react";
import { z } from "zod";
import { ProductRowToggles } from "@/components/admin/product-edit";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, inputClass } from "@/components/ui/form-controls";
import {
  PAGE_SIZE,
  STOCK_FILTERS,
  getLowStockThreshold,
  listProducts,
  type StockFilter,
} from "@/lib/admin-products";
import { requireAdmin } from "@/lib/auth";
import { formatUsd } from "@/lib/format";
import { isLowStock } from "@/lib/stock-rules";
import { uuid } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Productos" };

const ESTADO_LABEL: Record<StockFilter, string> = {
  todos: "Todos",
  activos: "Activos",
  inactivos: "Inactivos",
  agotados: "Agotados",
  poco: "Poco stock",
};

export default async function ProductsPage(props: PageProps<"/admin/productos">) {
  await requireAdmin();
  const query = await props.searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const categoryId = uuid.safeParse(query.categoria).success ? (query.categoria as string) : undefined;
  const estado = z.enum(STOCK_FILTERS).catch("todos").parse(query.estado);
  const pagina = z.coerce.number().int().min(1).max(10_000).catch(1).parse(query.pagina);

  const threshold = await getLowStockThreshold();
  const { rows, total, tree } = await listProducts({ q: q || undefined, categoryId, estado, pagina }, threshold);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const hasFilters = Boolean(q || categoryId || estado !== "todos");

  const href = (next: { pagina?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (categoryId) sp.set("categoria", categoryId);
    if (estado !== "todos") sp.set("estado", estado);
    if (next.pagina && next.pagina > 1) sp.set("pagina", String(next.pagina));
    const qs = sp.toString();
    return qs ? `/admin/productos?${qs}` : "/admin/productos";
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Productos</h1>
        <Link href="/admin/productos/nuevo" className={buttonClass("primary", "md", "gap-2")}>
          <Plus className="size-4" aria-hidden />
          Nuevo producto
        </Link>
      </div>

      {/* Filtros: formulario GET, funciona sin JavaScript. */}
      <form method="get" action="/admin/productos" className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_auto]">
        <div>
          <label htmlFor="q" className="mb-1 block text-sm font-semibold text-ink">
            Buscar
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Nombre o SKU" maxLength={80} className={inputClass} />
        </div>
        <SelectField label="Categoría" name="categoria" defaultValue={categoryId ?? ""}>
          <option value="">Todas</option>
          {tree.map((root) => (
            <optgroup key={root.id} label={root.nombre}>
              <option value={root.id}>Toda {root.nombre}</option>
              {root.hijas.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <SelectField label="Estado" name="estado" defaultValue={estado}>
          {STOCK_FILTERS.map((f) => (
            <option key={f} value={f}>
              {ESTADO_LABEL[f]}
            </option>
          ))}
        </SelectField>
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonClass("primary", "md")}>
            Filtrar
          </button>
          {hasFilters && (
            <Link href="/admin/productos" className={buttonClass("ghost", "md")}>
              Limpiar
            </Link>
          )}
        </div>
      </form>
      <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
        {total} {total === 1 ? "producto" : "productos"}
        {estado === "poco" && ` con ${threshold} unidades o menos`}
      </p>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon={<Package className="size-8" aria-hidden />} title={hasFilters ? "No hay productos con esos filtros" : "Aún no hay productos"}>
            {hasFilters ? "Prueba con otra búsqueda o limpia los filtros." : "Crea el primero con “Nuevo producto”."}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => {
              const low = isLowStock(p.stock, p.stockReservado, threshold);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line bg-surface p-3 sm:p-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-line bg-soft">
                    {p.imagen ? (
                      // Miniatura pública del bucket.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagen} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-ink-soft/60">
                        <ImageOff className="size-5" aria-label="Sin imagen" role="img" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{p.nombre}</p>
                      {!p.activo && <span className="rounded-full bg-bg-alt px-2.5 py-0.5 text-xs font-semibold text-ink">Inactivo</span>}
                      {p.destacado && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">Destacado</span>}
                    </div>
                    <p className="truncate text-sm text-ink-soft">
                      {p.categoria}
                      {p.sku ? ` · SKU ${p.sku}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">{formatUsd(p.precio)}</p>
                    <p className={cn("text-sm", low ? "font-semibold text-sale-ink" : "text-ink-soft")}>
                      Stock {p.stock}
                      {p.stockReservado > 0 ? ` (${p.stockReservado} reservadas)` : ""}
                      {low ? " · poco" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <ProductRowToggles id={p.id} activo={p.activo} destacado={p.destacado} nombre={p.nombre} />
                    <Link href={`/admin/productos/${p.id}`} className={buttonClass("secondary", "sm", "gap-2")}>
                      <Pencil className="size-4" aria-hidden />
                      Editar
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-4">
          {pagina > 1 ? (
            <Link href={href({ pagina: pagina - 1 })} className={buttonClass("secondary", "sm")}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-soft">
            Página {pagina} de {totalPages}
          </p>
          {pagina < totalPages ? (
            <Link href={href({ pagina: pagina + 1 })} className={buttonClass("secondary", "sm")}>
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
