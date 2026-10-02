import { NAV_ITEMS } from "@/components/admin/admin-nav";
import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Marco del panel mientras se comprueba la sesión: el mismo menú lateral (sin pestaña activa ni
 * contadores) y el esqueleto del contenido. No lee la URL ni la sesión, así que forma parte del
 * contenido estático de cualquier ruta del panel, también las que tienen parámetros. En celular
 * muestra la barra superior del marco real.
 */
export function AdminShellSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="on-dark fixed inset-y-0 left-0 hidden w-64 flex-col bg-accent-hover text-bg lg:flex">
        <div className="px-5 py-4">
          <p className="text-lg font-semibold">Mi casa Store</p>
          <p className="text-sm text-accent-mid">Panel del dueño</p>
        </div>
        <ul className="flex-1 space-y-1 px-3 py-2" aria-hidden>
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-accent-mid">
              <item.icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </li>
          ))}
        </ul>
      </aside>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg px-4 py-2 lg:hidden">
        <span className="size-11" aria-hidden />
        <span className="text-lg font-semibold text-accent">Mi casa Store</span>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <PageSkeleton label="Cargando el panel…" />
      </main>
    </div>
  );
}
