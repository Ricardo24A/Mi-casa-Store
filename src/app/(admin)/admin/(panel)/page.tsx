import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Resumen" };

export default async function ResumenPage() {
  const { fullName } = await requireAdmin();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        {fullName ? `Hola, ${fullName}` : "Hola"}
      </h1>
      <p className="mt-2 max-w-prose text-ink-soft">Desde el menú puedes administrar tu tienda.</p>
    </>
  );
}
