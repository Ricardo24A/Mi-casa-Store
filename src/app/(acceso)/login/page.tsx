import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";
import { accountRedirect } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Iniciar sesión" };

/** Quien ya tiene sesión no ve el formulario: un cliente vuelve a su destino; un admin, a su paso de 2FA. */
async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? safeNext(next, "") : "";

  const session = await getAdminSession();
  const target = accountRedirect("acceso", session);
  if (target) redirect(session.role === "customer" ? safeNext(next, target) : target);

  const toCheckout = nextPath.startsWith("/checkout");
  const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
      {toCheckout && (
        <p role="status" className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          Inicia sesión o crea una cuenta para pagar. Tu carrito se conserva.
        </p>
      )}
      {error === "enlace" && (
        <p role="alert" className="mt-3 rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">
          El enlace no es válido o ya venció. Pide uno nuevo.
        </p>
      )}
      <div className="mt-6">
        <LoginForm next={nextPath || undefined} />
      </div>
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Aún no tienes cuenta?{" "}
        <Link href={`/registro${query}`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
          Crear cuenta
        </Link>
      </p>
      <p className="text-center">
        <Link href="/catalogo" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
          Continuar como invitado
        </Link>
      </p>
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="h-96" aria-busy="true" />}>
      <LoginContent searchParams={props.searchParams} />
    </Suspense>
  );
}
