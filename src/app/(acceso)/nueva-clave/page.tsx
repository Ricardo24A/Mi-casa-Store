import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewPasswordForm } from "@/components/auth/auth-forms";
import { passwordChangeRules } from "@/lib/password-change";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contraseña nueva", robots: { index: false } };

/**
 * Cambio de contraseña para cualquier sesión (cliente o administrador). Desde el enlace de
 * recuperación no pide la contraseña actual; desde una sesión normal, sí. Un administrador con 2FA
 * sin validar en esta sesión confirma también con su código. Al guardar se cierra la sesión.
 */
async function NewPasswordContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Crea una contraseña nueva</h1>
        <p role="alert" className="mt-4 rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">
          El enlace venció o no hay una sesión abierta.
        </p>
        <p className="mt-4">
          <Link href="/recuperar" className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
            Pedir un enlace nuevo
          </Link>
        </p>
      </>
    );
  }

  const rules = await passwordChangeRules(user.id);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {rules.needsCurrent ? "Cambia tu contraseña" : "Crea una contraseña nueva"}
      </h1>
      <div className="mt-6">
        <NewPasswordForm needsCurrent={rules.needsCurrent} needsCode={rules.needsCode} />
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
