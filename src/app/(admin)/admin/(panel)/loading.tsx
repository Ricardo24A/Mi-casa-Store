import { PageSkeleton } from "@/components/ui/skeleton";

// Next envuelve cada página del panel en <Suspense> con este esqueleto: la página lee la sesión
// (requireAdmin) y datos sin caché, así que al navegar se ve la estructura al instante, no un blanco.
export default function PanelLoading() {
  return <PageSkeleton label="Cargando el panel…" />;
}
