import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { EmptyState } from "@/components/ui/empty-state";
import { getSettingsDefaults } from "@/lib/admin-settings";
import { requireAdmin } from "@/lib/auth";

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
    </>
  );
}
