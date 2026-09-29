import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mi Casa Store",
    template: "%s | Mi Casa Store",
  },
  description: "Productos para el hogar: cocina, dormitorio, decoración y más.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f0dfc6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
