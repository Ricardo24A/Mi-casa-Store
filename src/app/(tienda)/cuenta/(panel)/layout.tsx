import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AccountNav } from "@/components/account/account-nav";
import { Container } from "@/components/ui/container";
import { requireCustomer } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// La sesión se lee dentro de un componente con <Suspense> (Cache Components). Esta comprobación
// es solo una comodidad: cada página y cada acción vuelve a llamar a `requireCustomer()`.
async function AccountFrame({ children }: { children: ReactNode }) {
  const { fullName } = await requireCustomer();
  return (
    <Container className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Mi cuenta</h1>
      {fullName && <p className="mt-1 text-ink-soft">Hola, {fullName}.</p>}
      <div className="mt-6">
        <AccountNav />
      </div>
      <div className="mt-8">{children}</div>
    </Container>
  );
}

export default function AccountPanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Container className="py-8" aria-busy="true"><div className="h-64" /></Container>}>
      <AccountFrame>{children}</AccountFrame>
    </Suspense>
  );
}
