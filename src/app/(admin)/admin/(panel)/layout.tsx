import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// La sesión se lee dentro de un componente con <Suspense> (Cache Components no permite leer
// cookies en el nivel superior de un layout). Esta comprobación es solo una comodidad: cada
// página y cada acción vuelve a llamar a `requireAdmin()`, porque un layout no se re-ejecuta
// en cada navegación.
async function PanelFrame({ children }: { children: ReactNode }) {
  const { fullName } = await requireAdmin();
  // Pedidos con comprobante por revisar (RLS: el administrador con 2FA ve todos los pedidos).
  const supabase = await createClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("estado", "comprobante_recibido");
  return (
    <AdminShell fullName={fullName} pendingOrders={count ?? 0}>
      {children}
    </AdminShell>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  );
}
