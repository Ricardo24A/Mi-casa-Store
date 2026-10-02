import { PageSkeleton } from "@/components/ui/skeleton";

// Cada página de Mi cuenta lee la sesión (requireCustomer) y datos propios: al navegar entre ellas
// se muestra este esqueleto dentro del marco de la cuenta, nunca un blanco.
export default function AccountLoading() {
  return <PageSkeleton label="Cargando tu cuenta…" rows={3} />;
}
