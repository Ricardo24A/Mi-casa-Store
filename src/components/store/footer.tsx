import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { FacebookIcon } from "@/components/store/facebook-icon";
import { FACEBOOK_URL } from "@/config/site";
import { Container } from "@/components/ui/container";
import { getCategoryTree } from "@/lib/catalog";

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

/** Solo enlaces a páginas que existen. Los demás (contacto, legales) se añaden cuando existan. */
export async function Footer() {
  const categories = await getCategoryTree();

  return (
    <footer className="on-dark mt-12 bg-accent-hover text-bg">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">Mi casa Store</p>
          <p className="mt-2 max-w-xs text-sm text-accent-mid">Productos para el hogar.</p>
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
            Mi casa Store. Todos los derechos reservados.
          </p>
          {FACEBOOK_URL && (
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook de Mi casa Store"
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
