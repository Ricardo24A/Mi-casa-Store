import type { Metadata } from "next";
import Link from "next/link";
import { AddressForm } from "@/components/account/profile-forms";
import { requireCustomer } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva dirección" };

export default async function NewAddressPage() {
  await requireCustomer();
  return (
    <>
      <Link href="/cuenta/direcciones" className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a mis direcciones
      </Link>
      <h2 className="mb-4 text-xl font-semibold text-ink">Nueva dirección</h2>
      <AddressForm
        initialValues={{
          etiqueta: "",
          destinatario: "",
          telefono: "",
          provincia: "",
          ciudad: "",
          direccion: "",
          referencia: "",
          es_predeterminada: false,
        }}
      />
    </>
  );
}
