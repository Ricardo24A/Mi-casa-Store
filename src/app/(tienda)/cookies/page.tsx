import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { cookies } from "@/content/legal";

export const metadata: Metadata = {
  title: cookies.titulo,
  description: "Qué son las cookies y cuáles utilizamos en nuestro sitio.",
};

export default function CookiesPage() {
  return <LegalPage doc={cookies} />;
}
