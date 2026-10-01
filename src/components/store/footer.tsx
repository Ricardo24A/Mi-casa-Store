import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { FacebookIcon } from "@/components/store/facebook-icon";
import { WhatsappIcon } from "@/components/store/whatsapp-icon";
import { Container } from "@/components/ui/container";
import { getCategoryTree } from "@/lib/catalog";
import { formatEcPhone, telHref, whatsappHref } from "@/lib/phone-ec";
import { getPublicStoreInfo } from "@/lib/store-info";

const linkClass =
  "inline-flex min-h-11 items-center text-accent-mid underline-offset-4 hover:text-bg hover:underline";

/**
 * Año actual. `new Date()` no puede leerse durante el prerender con cacheComponents, así que
 * se cachea (`'use cache'`, ver doc "Random values and timestamps") y se renueva cada día.
 */
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/** Solo enlaces a páginas que existen. Los demás (legales) se añaden cuando existan. */
export async function Footer() {
  const [categories, info] = await Promise.all([getCategoryTree(), getPublicStoreInfo()]);
  const phones = [info.telefono, info.telefonoSecundario].filter((p): p is string => Boolean(p));
  const hasContact = Boolean(info.email || phones.length > 0 || info.direccion);

  return (
    <footer className="on-dark mt-12 bg-accent-hover text-bg">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">{info.nombre}</p>
          <p className="mt-2 max-w-xs text-sm text-accent-mid">Productos para el hogar.</p>
          {hasContact && (
            <address className="mt-3 text-sm not-italic text-accent-mid">
              {info.direccion && <p>{info.direccion}</p>}
              {phones.map((phone) => {
                const wa = whatsappHref(phone);
                return (
                  <p key={phone} className="flex items-center gap-1">
                    <a href={telHref(phone)} className={linkClass}>
                      {formatEcPhone(phone)}
                    </a>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp ${formatEcPhone(phone)}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent hover:text-bg"
                      >
                        <WhatsappIcon className="size-5" />
                      </a>
                    )}
                  </p>
                );
              })}
              {info.email && (
                <p>
                  <a href={`mailto:${info.email}`} className={linkClass}>
                    {info.email}
                  </a>
                </p>
              )}
            </address>
          )}
        </div>

        <nav aria-label="Tienda">
          <p className="mb-2 text-sm font-semibold">Tienda</p>
          <ul className="text-sm">
            <li>
              <Link href="/catalogo" className={linkClass}>
                Todos los productos
              </Link>
            </li>
            <li>
              <Link href="/carrito" className={linkClass}>
                Carrito
              </Link>
            </li>
            <li>
              <Link href="/contacto" className={linkClass}>
                Contacto
              </Link>
            </li>
          </ul>
        </nav>

        {categories.length > 0 && (
          <nav aria-label="Categorías del pie">
            <p className="mb-2 text-sm font-semibold">Categorías</p>
            <ul className="text-sm">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/categoria/${cat.slug}`} className={linkClass}>
                    {cat.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </Container>
      <div className="border-t border-accent">
        <Container className="flex items-center justify-between gap-4 py-2 text-sm text-accent-mid">
          <p>
            ©{" "}
            <Suspense fallback={null}>
              <CurrentYear />
            </Suspense>{" "}
            {info.nombre}. Todos los derechos reservados.
          </p>
          {info.facebook && (
            <a
              href={info.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Facebook de ${info.nombre}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent hover:text-bg"
            >
              <FacebookIcon className="size-5" />
            </a>
          )}
        </Container>
      </div>
    </footer>
  );
}
