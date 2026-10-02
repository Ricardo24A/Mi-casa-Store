import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminShellSkeleton } from "@/components/admin/admin-shell-skeleton";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// La sesión se lee dentro de un componente con <Suspense> (Cache Components no permite leer
// cookies en el nivel superior de un layout). Esta comprobación es solo una comodidad: cada
// página y cada acción vuelve a llamar a `requireAdmin()`, porque un layout no se re-ejecuta
// en cada navegación.
async function PanelFrame({ children }: { children: ReactNode }) {
  const { fullName } = await requireAdmin();
  // Pedidos con comprobante por revisar y mensajes sin leer (RLS: solo el administrador con 2FA los ve).
  const supabase = await createClient();
  const [orders, messages] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("estado", "comprobante_recibido"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
  ]);
  return (
    <AdminShell fullName={fullName} counters={{ pedidos: orders.count ?? 0, mensajes: messages.count ?? 0 }}>
      {children}
    </AdminShell>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    // Mientras se comprueba la sesión: el mismo marco del panel (menú lateral sin contadores) con el
    // esqueleto del contenido. Nunca una pantalla en blanco.
    <Suspense
      fallback={<AdminShellSkeleton />}
    >
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  );
}
