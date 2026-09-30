import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RecoverForm } from "@/components/auth/auth-forms";
import { accountRedirect } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Recuperar contraseña" };

async function RecoverContent() {
  const target = accountRedirect("acceso", await getAdminSession());
  if (target) redirect(target);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
      </p>
      <div className="mt-6">
        <RecoverForm />
      </div>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}

export default function RecoverPage() {
  return (
    <Suspense fallback={<div className="h-64" aria-busy="true" />}>
      <RecoverContent />
    </Suspense>
  );
}
