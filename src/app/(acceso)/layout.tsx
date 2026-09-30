import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

// Login único: no se indexa (también está bloqueado en robots.txt) y no usa el header/footer de la tienda.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccesoLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
