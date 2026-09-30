import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProduct, ProductEditForm, ProductImagesManager } from "@/components/admin/product-edit";
import { getAdminCategoryTree } from "@/lib/admin-categories";
import { getProductForEdit, subcategoryOptions } from "@/lib/admin-products";
import { requireAdmin } from "@/lib/auth";
import { availableStock } from "@/lib/stock-rules";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage(props: PageProps<"/admin/productos/[id]">) {
  await requireAdmin();
  const id = uuid.safeParse((await props.params).id);
  if (!id.success) notFound();

  const [product, tree] = await Promise.all([getProductForEdit(id.data), getAdminCategoryTree()]);
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/productos" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a productos
      </Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold tracking-tight text-ink">Editar {product.nombre}</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Dirección en la tienda: <span className="font-mono text-ink">/producto/{product.slug}</span>. Cambiar el nombre no la cambia.
        {" "}Disponible para vender: <span className="font-semibold text-ink">{availableStock(product.stock, product.stockReservado)}</span>{" "}
        ({product.stock} en stock, {product.stockReservado} reservadas).
      </p>

      <ProductEditForm
        id={product.id}
        categoryId={product.categoryId}
        options={subcategoryOptions(tree)}
        reserved={product.stockReservado}
        defaults={{
          nombre: product.nombre,
          descripcion: product.descripcion,
          precio: String(product.precio).replace(".", ","),
          stock: String(product.stock),
          sku: product.sku ?? "",
          activo: product.activo,
          destacado: product.destacado,
        }}
      />

      <section aria-labelledby="imagenes" className="mt-10 max-w-3xl">
        <h2 id="imagenes" className="mb-3 text-xl font-semibold text-ink">
          Imágenes
        </h2>
        <ProductImagesManager productId={product.id} images={product.images.map((i) => ({ id: i.id, url: i.url }))} />
      </section>

      <div className="mt-10">
        <DeleteProduct id={product.id} nombre={product.nombre} hasOrders={product.hasOrders} />
      </div>
    </>
  );
}
