import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { privacidad } from "@/content/legal";

export const metadata: Metadata = {
  title: privacidad.titulo,
  description: "Cómo recopilamos, usamos y protegemos su información personal.",
};

export default function PrivacyPage() {
  return <LegalPage doc={privacidad} />;
}
