import Link from "next/link";
import { BedDouble, CookingPot, Lamp, Sofa, Store } from "lucide-react";
import { CategoryIcon } from "@/components/store/category-icon";
import { ProductGrid } from "@/components/store/product-card";
import { ProductImage } from "@/components/store/product-image";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { getCatalogProducts, getCategoryTree } from "@/lib/catalog";

const SECTION_SIZE = 8;

function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    getCategoryTree(),
    getCatalogProducts({}),
  ]);

  // Sin productos activos no hay categorías visibles: mensaje sencillo (CLAUDE.md sección 4).
  if (products.length === 0) {
    return (
      <Container className="py-16">
        <EmptyState icon={<Store className="size-8" aria-hidden />} title="Estamos preparando el catálogo">
          Muy pronto tendrás aquí nuestros productos para el hogar.
        </EmptyState>
      </Container>
    );
  }

  const popular = products.filter((p) => p.destacado).slice(0, SECTION_SIZE);
  const offers = products.filter((p) => p.descuentoPct !== null).slice(0, SECTION_SIZE);

  return (
    <>
      <section className="pt-6 sm:pt-8">
        <Container>
          <div className="on-dark grid items-center gap-10 overflow-hidden rounded-2xl bg-accent px-6 py-12 sm:px-12 sm:py-16 md:grid-cols-[1.15fr_1fr]">
            <div>
              <h1 className="max-w-xl text-balance text-4xl font-semibold leading-tight tracking-tight text-bg sm:text-5xl">
                Todo para tu hogar
              </h1>
              <p className="mt-4 max-w-md text-lg text-accent-mid">
                Encuentra productos para cada rincón de tu casa.
              </p>
              <Link href="/catalogo" className={buttonClass("onDark", "lg", "mt-8")}>
                Ver productos
              </Link>
            </div>

            {/* Composición decorativa: iconos de la casa, sin fotos ni cifras. */}
            <div aria-hidden className="hidden w-full max-w-72 grid-cols-2 gap-3 justify-self-end md:grid">
              <div className="flex aspect-square items-center justify-center rounded-xl bg-accent-hover text-accent-mid">
                <Sofa className="size-10" strokeWidth={1.5} />
              </div>
              <div className="mt-6 flex aspect-square items-center justify-center rounded-xl bg-accent-mid text-accent">
                <CookingPot className="size-10" strokeWidth={1.5} />
              </div>
              <div className="-mt-6 flex aspect-square items-center justify-center rounded-xl bg-accent-soft text-accent">
                <BedDouble className="size-10" strokeWidth={1.5} />
              </div>
              <div className="flex aspect-square items-center justify-center rounded-xl bg-accent-hover text-accent-mid">
                <Lamp className="size-10" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <h2 className="mb-6 text-2xl font-semibold text-ink">Categorías</h2>
        <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/categoria/${cat.slug}`}
                className="lift on-dark group flex h-full flex-col overflow-hidden rounded-card bg-accent text-bg hover:bg-accent-hover"
              >
                {cat.imagenUrl ? (
                  <ProductImage src={cat.imagenUrl} alt="" sizes="(min-width: 1024px) 25vw, 50vw" />
                ) : (
                  <span className="mx-5 mt-5 flex size-12 items-center justify-center rounded-lg bg-accent-hover text-accent-mid group-hover:bg-accent">
                    <CategoryIcon slug={cat.slug} className="size-6" />
                  </span>
                )}
                <span className="px-5 pt-4 text-lg font-semibold">{cat.nombre}</span>
                <span className="mt-1 px-5 pb-5 text-sm text-accent-mid">
                  {cat.subcategorias
                    .slice(0, 3)
                    .map((s) => s.nombre)
                    .join(", ")}
                  {cat.subcategorias.length > 3 ? ` y ${cat.subcategorias.length - 3} más` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      {popular.length > 0 && (
        <section className="pb-12">
          <Container>
            <SectionHeading title="Más populares" href="/catalogo" linkLabel="Ver todos" />
            <ProductGrid products={popular} />
          </Container>
        </section>
      )}

      {offers.length > 0 && (
        <section className="pb-12">
          <Container>
            <SectionHeading title="Ofertas especiales" href="/catalogo" linkLabel="Ver todos" />
            <ProductGrid products={offers} />
          </Container>
        </section>
      )}
    </>
  );
}
