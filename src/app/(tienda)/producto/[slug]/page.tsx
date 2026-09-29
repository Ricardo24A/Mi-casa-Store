import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/store/add-to-cart";
import { PriceTag } from "@/components/store/price-tag";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductGrid } from "@/components/store/product-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { getCatalogProducts, getProductBySlug } from "@/lib/catalog";
import { slug as slugSchema } from "@/lib/validation/common";

const LOW_STOCK = 5;

async function parseSlug(params: PageProps<"/producto/[slug]">["params"]) {
  const parsed = slugSchema.safeParse((await params).slug);
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata(props: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const slug = await parseSlug(props.params);
  const product = slug ? await getProductBySlug(slug) : null;
  if (!product) return { title: "No encontrado", robots: { index: false } };
  return {
    title: product.nombre,
    description: product.descripcion.slice(0, 160) || `${product.nombre} en Mi casa Store.`,
    openGraph: product.imagenes[0] ? { images: [product.imagenes[0]] } : undefined,
  };
}

async function ProductContent(props: PageProps<"/producto/[slug]">) {
  const slug = await parseSlug(props.params);
  const product = slug ? await getProductBySlug(slug) : null;
  // Inexistente o inactivo: 404.
  if (!product) notFound();

  const related = (await getCatalogProducts({ scopeSlug: product.subcategoria.slug }))
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <Container className="py-8">
      <Breadcrumbs
        items={[
          { label: product.categoria.nombre, href: `/categoria/${product.categoria.slug}` },
          { label: product.subcategoria.nombre, href: `/categoria/${product.subcategoria.slug}` },
          { label: product.nombre },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.imagenes} name={product.nombre} />

        <div>
          <p className="text-sm text-ink-soft">{product.subcategoria.nombre}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{product.nombre}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PriceTag product={product} size="lg" />
            {product.descuentoPct !== null && (
              <span className="rounded-full bg-sale-ink px-3 py-1 text-sm font-semibold text-white">
                -{product.descuentoPct}%
              </span>
            )}
          </div>

          <p className="mt-3 text-sm font-semibold">
            {product.disponible === 0 ? (
              <span className="text-sale-ink">Agotado</span>
            ) : product.disponible <= LOW_STOCK ? (
              <span className="text-sale-ink">
                Quedan {product.disponible} {product.disponible === 1 ? "unidad" : "unidades"}
              </span>
            ) : (
              <span className="text-accent">Disponible</span>
            )}
          </p>

          <div className="mt-6">
            <AddToCart productId={product.id} disponible={product.disponible} />
          </div>

          {product.descripcion && (
            <section className="mt-8 border-t border-line pt-6">
              <h2 className="mb-2 text-base font-semibold text-ink">Descripción</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {product.descripcion}
              </p>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-2xl font-semibold text-ink">Más de {product.subcategoria.nombre}</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </Container>
  );
}

export default function ProductPage(props: PageProps<"/producto/[slug]">) {
  return (
    <Suspense fallback={<Container className="py-8" aria-busy="true"><div className="aspect-square max-w-xl animate-pulse rounded-card bg-bg-alt" /></Container>}>
      <ProductContent {...props} />
    </Suspense>
  );
}
