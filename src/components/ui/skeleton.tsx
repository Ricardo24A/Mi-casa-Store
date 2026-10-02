import { cn } from "@/lib/utils";

/** Bloque gris de carga. Decorativo: el contenedor anuncia la carga con aria-busy y un texto oculto. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-bg-alt motion-reduce:animate-none", className)} />;
}

/**
 * Esqueleto de una pantalla de contenido (título, filtros y una lista de tarjetas) para los
 * `loading.tsx` y los respaldos de <Suspense>: nunca una pantalla en blanco mientras llegan los datos.
 */
export function PageSkeleton({ label = "Cargando…", rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-6">
      <p className="sr-only" role="status">
        {label}
      </p>
      <SkeletonBlock className="h-9 w-56" />
      <div className="flex flex-wrap gap-2">
        <SkeletonBlock className="h-11 w-24 rounded-full" />
        <SkeletonBlock className="h-11 w-28 rounded-full" />
        <SkeletonBlock className="h-11 w-24 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-40 max-w-full" />
              <SkeletonBlock className="h-3 w-64 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
