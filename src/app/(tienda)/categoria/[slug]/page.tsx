import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogSkeleton, CatalogView } from "@/components/store/catalog-view";
import { getCategoryScope } from "@/lib/catalog";
import { slug as slugSchema } from "@/lib/validation/common";

async function parseSlug(params: PageProps<"/categoria/[slug]">["params"]) {
  const parsed = slugSchema.safeParse((await params).slug);
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata(props: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const slug = await parseSlug(props.params);
  const scope = slug ? await getCategoryScope(slug) : null;
  if (!scope) return { title: "No encontrado", robots: { index: false } };
  const name = scope.tipo === "subcategoria" ? scope.subcategoria.nombre : scope.categoria.nombre;
  return { title: name, description: `${name} en Mi casa Store.` };
}

async function CategoryContent(props: PageProps<"/categoria/[slug]">) {
  const slug = await parseSlug(props.params);
  // Categoría o subcategoría inexistente, o sin productos activos: 404.
  if (!slug) notFound();
  return <CatalogView scopeSlug={slug} searchParams={props.searchParams} />;
}

export default function CategoryPage(props: PageProps<"/categoria/[slug]">) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}
