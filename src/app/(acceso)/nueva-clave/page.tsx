import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPasswordForm } from "@/components/auth/auth-forms";
import { requireCustomer } from "@/lib/auth";

export const metadata: Metadata = { title: "Contraseña nueva" };

async function NewPasswordContent() {
  // Se llega desde el enlace del correo, que abre una sesión de cliente.
  await requireCustomer();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Crea una contraseña nueva</h1>
      <div className="mt-6">
        <NewPasswordForm />
      </div>
    </>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64" aria-busy="true" />}>
      <NewPasswordContent />
    </Suspense>
  );
}
