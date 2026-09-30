import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressForm } from "@/components/account/profile-forms";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Editar dirección" };

export default async function EditAddressPage(props: PageProps<"/cuenta/direcciones/[id]">) {
  const { userId } = await requireCustomer();
  const id = uuid.safeParse((await props.params).id);
  if (!id.success) notFound();

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("customer_addresses")
    .select("id, etiqueta, destinatario, telefono, provincia, ciudad, direccion, referencia, es_predeterminada")
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!a) notFound();

  return (
    <>
      <Link href="/cuenta/direcciones" className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a mis direcciones
      </Link>
      <h2 className="mb-4 text-xl font-semibold text-ink">Editar dirección</h2>
      <AddressForm initialValues={{ ...a, referencia: a.referencia ?? "" }} />
    </>
  );
}
