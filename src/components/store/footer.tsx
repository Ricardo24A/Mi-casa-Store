import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { BrandLink } from "@/components/brand-icons";
import { Container } from "@/components/ui/container";
import { CATALOG_TAG, getCategoryTree } from "@/lib/catalog";
import { formatEcPhone, telHref, whatsappHref } from "@/lib/phone-ec";
import { STORE_INFO_TAG, getPublicStoreInfo } from "@/lib/store-info";

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

/**
 * Datos del pie: categorías visibles y datos públicos del negocio. Es lo mismo para todos, así que
 * se cachea (cliente de Supabase sin cookies ni sesión, dentro de las funciones de catálogo y de
 * `store_public_info`). Se renueva al guardar Configuración (`updateTag("tienda")`) o al cambiar el
 * catálogo (`updateTag("catalogo")`).
 */
async function getFooterData() {
  "use cache";
  cacheLife("hours");
  cacheTag(STORE_INFO_TAG, CATALOG_TAG);
  const [categories, info] = await Promise.all([getCategoryTree(), getPublicStoreInfo()]);
  return { categories, info };
}

/** Respaldo mientras llegan los datos del pie: la misma franja, sin contenido. */
export function FooterFallback() {
  return <footer aria-busy="true" className="mt-12 h-56 bg-accent-hover" />;
}

/** Solo enlaces a páginas que existen. Los demás (legales) se añaden cuando existan. */
export async function Footer() {
  const { categories, info } = await getFooterData();
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
                    {wa && <BrandLink brand="whatsapp" href={wa} label={`WhatsApp ${formatEcPhone(phone)}`} className="hover:bg-accent" />}
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
          {info.facebook && <BrandLink brand="facebook" href={info.facebook} className="hover:bg-accent" />}
        </Container>
      </div>
    </footer>
  );
}
