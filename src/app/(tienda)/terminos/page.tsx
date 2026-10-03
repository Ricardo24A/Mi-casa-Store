import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { terminos } from "@/content/legal";
import { getPaymentDeadlineHours } from "@/lib/legal-data";

export const metadata: Metadata = {
  title: terminos.titulo,
  description: "Condiciones de compra, pago, envíos y devoluciones.",
};

export default async function TermsPage() {
  // El plazo de pago que se muestra es el real de Configuración (horas_limite_pago), no un número fijo.
  const horas = await getPaymentDeadlineHours();
  return <LegalPage doc={terminos} horas={horas} />;
}
