import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton, CatalogView } from "@/components/store/catalog-view";

export const metadata: Metadata = {
  title: "Productos",
  description: "Todos los productos de Mi casa Store.",
};

export default function CatalogPage(props: PageProps<"/catalogo">) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogView searchParams={props.searchParams} />
    </Suspense>
  );
}
