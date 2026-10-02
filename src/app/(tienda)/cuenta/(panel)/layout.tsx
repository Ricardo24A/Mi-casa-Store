import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { Container } from "@/components/ui/container";
import { SkeletonBlock } from "@/components/ui/skeleton";
import { getAdminSessionUncached } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// El marco de Mi cuenta se pinta sin leer la sesión, para no bloquear ninguna navegación (Cache
// Components). Lo que depende de ella va en hijos con <Suspense> y respaldo visible:
//   - Greeting: "Hola, nombre" (respaldo: una línea vacía de la misma altura).
//   - AccountNav: las pestañas leen la URL (respaldo: un bloque con su altura).
// Las páginas no quedan dentro de ningún componente que espere la sesión; su carga la cubre loading.tsx.
// El acceso lo decide requireCustomer() al inicio de CADA página y acción (y RLS en la base); el saludo
// usa su propia lectura de la sesión (ver getAdminSessionUncached).

async function Greeting() {
  const session = await getAdminSessionUncached();
  if (session.role !== "customer" || !session.fullName) return <p className="mt-1 h-6" aria-hidden />;
  return <p className="mt-1 text-ink-soft">Hola, {session.fullName}.</p>;
}

export default function AccountPanelLayout({ children }: { children: ReactNode }) {
  return (
    <Container className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Mi cuenta</h1>
      <Suspense fallback={<p className="mt-1 h-6" aria-hidden />}>
        <Greeting />
      </Suspense>
      <div className="mt-6">
        <Suspense fallback={<SkeletonBlock className="h-[52px]" />}>
          <AccountNav />
        </Suspense>
      </div>
      <div className="mt-8">{children}</div>
    </Container>
  );
}
