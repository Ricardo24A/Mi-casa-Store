import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyForm } from "@/components/admin/verify-form";
import { getVerifiedFactors, guardAdminArea } from "@/lib/auth";

export const metadata: Metadata = { title: "Verificar código" };

async function VerifyContent() {
  await guardAdminArea("verificar");
  const factors = await getVerifiedFactors();
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">Verificación en dos pasos</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">
        Escribe el código que muestra tu app de autenticación.
      </p>
      <VerifyForm factors={factors} />
    </>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="h-72" aria-busy="true" />}>
      <VerifyContent />
    </Suspense>
  );
}
