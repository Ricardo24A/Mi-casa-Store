import type { MetadataRoute } from "next";
import { getCategoryTree, getProductSlugs } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site-url";

/** Solo lo visible: categorías con productos activos y esos productos (CLAUDE.md sección 4). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const [tree, products] = await Promise.all([getCategoryTree(), getProductSlugs()]);

  return [
    { url: `${base}/` },
    { url: `${base}/catalogo` },
    { url: `${base}/contacto` },
    { url: `${base}/privacidad` },
    { url: `${base}/terminos` },
    { url: `${base}/cookies` },
    ...tree.flatMap((cat) => [
      { url: `${base}/categoria/${cat.slug}` },
      ...cat.subcategorias.map((sub) => ({ url: `${base}/categoria/${sub.slug}` })),
    ]),
    ...products.map((p) => ({ url: `${base}/producto/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
