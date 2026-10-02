import type { Metadata } from "next";
import Link from "next/link";
import { SettingsForm } from "@/components/admin/settings-form";
import { EmptyState } from "@/components/ui/empty-state";
import { getSettingsDefaults } from "@/lib/admin-settings";
import { requireAdmin } from "@/lib/auth";

// Panel privado: exige sesión y 2FA y no se beneficia de un armazón instantáneo. Se exime de la
// validación de navegación instantánea de Cache Components (el acceso lo sigue cuidando requireAdmin()).
export const instant = false;

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requireAdmin();
  const defaults = await getSettingsDefaults();

  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-ink">Configuración</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink-soft">
        Estos datos se usan en la tienda y al cobrar cada pedido. Lo que dejes vacío no se muestra ni se cobra: la tienda
        funciona sin ello.
      </p>
      {defaults ? (
        <SettingsForm defaults={defaults} />
      ) : (
        <EmptyState title="No encontramos la configuración">Revisa que la migración de la base de datos esté aplicada.</EmptyState>
      )}
      <section aria-labelledby="seguridad" className="mt-6 max-w-3xl rounded-card border border-line bg-surface p-5">
        <h2 id="seguridad" className="text-lg font-semibold text-ink">
          Seguridad
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Para cambiar tu contraseña se pide la actual. Al guardarla se cierra la sesión y vuelves a entrar con la nueva y tu código de 2 pasos.
        </p>
        <Link href="/nueva-clave" className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
          Cambiar mi contraseña
        </Link>
      </section>
    </>
  );
}
