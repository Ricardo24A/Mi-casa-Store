import { Suspense, type ReactNode } from "react";
import { AdminShell, PanelNav, PanelNavStatic } from "@/components/admin/admin-shell";
import { getAdminSessionUncached } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// El marco del panel (menú lateral y encabezado) se pinta SIN leer la sesión: así no bloquea ninguna
// navegación (Cache Components). Lo que sí depende de la sesión vive en componentes hijos dentro de
// <Suspense>, cada uno con un respaldo visible y con su propia lectura de la sesión (ver
// getAdminSessionUncached):
//   - PanelNavLive: la sección activa y los contadores (respaldo: el menú sin contadores).
//   - AdminName: el nombre al pie del menú (respaldo: "Administrador").
// Las páginas no quedan dentro de ningún componente que espere la sesión; su carga la cubre loading.tsx.
// El acceso lo deciden el proxy (primera barrera), requireAdmin() al inicio de CADA página y acción, y
// RLS en la base: el layout no es una barrera (un layout no se vuelve a ejecutar en cada navegación).

/** Comprobantes por revisar y mensajes sin leer (RLS: solo el admin con 2FA los ve; si no, quedan en 0). */
async function PanelNavLive() {
  const session = await getAdminSessionUncached();
  if (session.role !== "admin" || session.aal !== "aal2") return <PanelNav counters={null} />;
  const supabase = await createClient();
  const [orders, messages] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("estado", "comprobante_recibido"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
  ]);
  return <PanelNav counters={{ pedidos: orders.count ?? 0, mensajes: messages.count ?? 0 }} />;
}

async function AdminName() {
  const session = await getAdminSessionUncached();
  return <>{session.role === "admin" && session.fullName ? session.fullName : "Administrador"}</>;
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      nav={
        <Suspense fallback={<PanelNavStatic />}>
          <PanelNavLive />
        </Suspense>
      }
      user={
        <Suspense fallback="Administrador">
          <AdminName />
        </Suspense>
      }
    >
      {children}
    </AdminShell>
  );
}
