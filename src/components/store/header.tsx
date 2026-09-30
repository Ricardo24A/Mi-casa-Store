import Link from "next/link";
import { ChevronDown, User } from "lucide-react";
import { CartLink } from "@/components/store/cart-link";
import { MobileMenu } from "@/components/store/mobile-menu";
import { SearchForm } from "@/components/store/search-form";
import { Container } from "@/components/ui/container";
import { getCategoryTree } from "@/lib/catalog";

export async function Header() {
  // Solo categorías y subcategorías con productos activos (CLAUDE.md sección 4).
  const categories = await getCategoryTree();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <Container className="flex items-center gap-2 py-3 sm:gap-4">
        <MobileMenu categories={categories} />
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center text-lg font-semibold tracking-tight text-accent">
          Mi casa Store
        </Link>
        <SearchForm className="mx-auto hidden w-full max-w-md md:block" />
        <div className="ml-auto flex items-center md:ml-0">
          <Link
            href="/cuenta"
            aria-label="Mi cuenta"
            className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-bg-alt"
          >
            <User className="size-5" aria-hidden />
          </Link>
          <CartLink />
        </div>
      </Container>

      <Container className="pb-3 md:hidden">
        <SearchForm />
      </Container>

      {categories.length > 0 && (
        <nav aria-label="Categorías" className="hidden border-t border-line/70 md:block">
          <Container>
            <ul className="flex flex-wrap items-center gap-x-1">
              {categories.map((cat) => (
                <li key={cat.id} className="group relative">
                  <Link
                    href={`/categoria/${cat.slug}`}
                    className="flex min-h-11 items-center gap-1 px-3 text-sm font-semibold text-ink hover:text-accent"
                  >
                    {cat.nombre}
                    <ChevronDown className="size-3.5" aria-hidden />
                  </Link>
                  <div className="invisible absolute left-0 top-full z-50 min-w-56 rounded-b-card border border-t-0 border-line bg-surface py-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul>
                      <li>
                        <Link
                          href={`/categoria/${cat.slug}`}
                          className="flex min-h-11 items-center px-4 text-sm font-semibold text-accent hover:bg-soft"
                        >
                          Ver todo en {cat.nombre}
                        </Link>
                      </li>
                      {cat.subcategorias.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/categoria/${sub.slug}`}
                            className="flex min-h-11 items-center px-4 text-sm text-ink-soft hover:bg-soft hover:text-ink"
                          >
                            {sub.nombre}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </nav>
      )}
    </header>
  );
}
