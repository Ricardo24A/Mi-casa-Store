import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

// Fuente variable: sin lista de pesos. El diseño solo usa 400 y 600.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Mi casa Store",
    template: "%s | Mi casa Store",
  },
  description: "Productos para el hogar.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f0dfc6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={dmSans.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
