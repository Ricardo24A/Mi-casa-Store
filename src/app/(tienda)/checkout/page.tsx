import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView, type SavedAddress } from "@/components/checkout/checkout-view";
import { Container } from "@/components/ui/container";
import { requireCustomer } from "@/lib/auth";
import { getCheckoutSettings } from "@/lib/store-settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

async function CheckoutContent() {
  // Sin sesión de cliente: al login, y al volver el carrito sigue en el navegador.
  const { userId, fullName } = await requireCustomer("/checkout");

  const supabase = await createClient();
  const [{ data: profile }, { data: addresses }, settings] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", userId).maybeSingle(),
    supabase
      .from("customer_addresses")
      .select("id, etiqueta, destinatario, telefono, provincia, ciudad, direccion, referencia, es_predeterminada")
      .eq("user_id", userId)
      .order("es_predeterminada", { ascending: false })
      .order("created_at")
      .returns<SavedAddress[]>(),
    // Los ajustes solo los lee el admin por RLS; el servidor entrega al comprador únicamente
    // los números que necesita para ver su total (y si ya hay cuentas para pagar).
    getCheckoutSettings(),
  ]);

  return (
    <Container className="py-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-ink">Finalizar compra</h1>
      <CheckoutView
        fullName={fullName ?? ""}
        phone={profile?.phone ?? ""}
        addresses={addresses ?? []}
        settings={{
          costo_envio: settings?.costo_envio ?? null,
          envio_gratis_desde: settings?.envio_gratis_desde ?? null,
          descuento_transferencia_pct: settings?.descuento_transferencia_pct ?? 0,
        }}
        canPay={(settings?.cuentas_bancarias.length ?? 0) > 0}
      />
    </Container>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Container className="py-8" aria-busy="true"><div className="h-64" /></Container>}>
      <CheckoutContent />
    </Suspense>
  );
}
