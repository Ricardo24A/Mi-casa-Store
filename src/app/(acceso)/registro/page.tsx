import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";
import { accountRedirect } from "@/lib/admin-access";
import { getAdminSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Crear cuenta" };

async function RegisterContent({ searchParams }: { searchParams: PageProps<"/registro">["searchParams"] }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeNext(next, "") : "";

  const session = await getAdminSession();
  const target = accountRedirect("acceso", session);
  if (target) redirect(session.role === "customer" ? safeNext(next, target) : target);

  const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Crear cuenta</h1>
      {nextPath.startsWith("/checkout") ? (
        <p role="status" className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          Crea una cuenta para pagar. Tu carrito se conserva.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">Guarda tus datos y revisa tus pedidos en un solo lugar.</p>
      )}
      <div className="mt-6">
        <RegisterForm next={nextPath || undefined} />
      </div>
      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/login${query}`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
          Iniciar sesión
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

export default function RegisterPage(props: PageProps<"/registro">) {
  return (
    <Suspense fallback={<div className="h-96" aria-busy="true" />}>
      <RegisterContent searchParams={props.searchParams} />
    </Suspense>
  );
}
