import type { Metadata } from "next";

// El dashboard nunca debe indexarse (también está bloqueado en robots.txt).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/">) {
  return children;
}
