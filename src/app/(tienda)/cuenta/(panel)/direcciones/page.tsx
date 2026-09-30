import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { eliminarDireccion, hacerPredeterminada } from "@/app/(tienda)/cuenta/actions";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Direcciones" };

interface AddressRow {
  id: string;
  etiqueta: string;
  destinatario: string;
  telefono: string;
  provincia: string;
  ciudad: string;
  direccion: string;
  referencia: string | null;
  es_predeterminada: boolean;
}

export default async function AddressesPage() {
  const { userId } = await requireCustomer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_addresses")
    .select("id, etiqueta, destinatario, telefono, provincia, ciudad, direccion, referencia, es_predeterminada")
    .eq("user_id", userId)
    .order("es_predeterminada", { ascending: false })
    .order("created_at")
    .returns<AddressRow[]>();
  const addresses = data ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink">Direcciones de envío</h2>
        {addresses.length > 0 && (
          <Link href="/cuenta/direcciones/nueva" className={buttonClass("primary", "md")}>
            Agregar dirección
          </Link>
        )}
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-8" aria-hidden />}
          title="Aún no tienes direcciones"
          action={
            <Link href="/cuenta/direcciones/nueva" className={buttonClass("primary")}>
              Agregar dirección
            </Link>
          }
        >
          Guárdalas aquí para comprar más rápido.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-card border border-line bg-surface p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-ink">{a.etiqueta}</p>
                {a.es_predeterminada && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                    Principal
                  </span>
                )}
              </div>
              <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-ink-soft">
                {a.destinatario} · {a.telefono}
                <br />
                {a.direccion}
                <br />
                {a.ciudad}, {a.provincia}
                {a.referencia && (
                  <>
                    <br />
                    Ref.: {a.referencia}
                  </>
                )}
              </address>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/cuenta/direcciones/${a.id}`} className={buttonClass("secondary", "sm")}>
                  Editar
                </Link>
                {!a.es_predeterminada && (
                  <form action={hacerPredeterminada}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className={buttonClass("ghost", "sm")}>
                      Hacer principal
                    </button>
                  </form>
                )}
                <form action={eliminarDireccion} className="ml-auto">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className={buttonClass("ghost", "sm", "text-sale-ink")}>
                    Eliminar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
