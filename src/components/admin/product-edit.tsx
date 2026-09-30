"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import {
  accionImagen,
  alternarProducto,
  editarProducto,
  eliminarProducto,
  quitarImagenCategoria,
  subirImagenCategoria,
  subirImagenProducto,
  type ProductActionState,
} from "@/app/(admin)/admin/(panel)/productos/actions";
import { ImageUploader } from "@/components/admin/image-tools";
import { ProductFields, type ProductDefaults } from "@/components/admin/product-fields";
import { buttonClass } from "@/components/ui/button";
import { FormError, FormSuccess, SelectField, SubmitButton } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

const initial: ProductActionState = {};
const MAX_IMAGES = 8;

export function ProductEditForm({
  id,
  categoryId,
  options,
  defaults,
  reserved,
}: {
  id: string;
  categoryId: string;
  options: { id: string; label: string; activa: boolean }[];
  defaults: ProductDefaults;
  reserved: number;
}) {
  const [state, action] = useActionState(editarProducto, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      <input type="hidden" name="id" value={id} />
      <SelectField label="Subcategoría *" name="categoryId" defaultValue={categoryId} error={e.categoryId} className="max-w-md">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.activa ? "" : " (desactivada)"}
          </option>
        ))}
      </SelectField>
      <ProductFields defaults={defaults} errors={e} stockMin={reserved} reserved={reserved} />
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.ok}</FormSuccess>
      <SubmitButton className="sm:w-auto" pendingLabel="Guardando…">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}

export function ProductImagesManager({
  productId,
  images,
}: {
  productId: string;
  images: { id: string; url: string }[];
}) {
  const [state, action] = useActionState(accionImagen, initial);
  const small = "inline-flex size-11 items-center justify-center rounded-lg text-ink transition-colors duration-150 hover:bg-bg-alt disabled:opacity-40 disabled:hover:bg-transparent";
  const form = (imageId: string, intent: string, label: string, icon: React.ReactNode, disabled?: boolean, extra?: string) => (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="imageId" value={imageId} />
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" disabled={disabled} className={cn(small, extra)} aria-label={label}>
        {icon}
      </button>
    </form>
  );

  return (
    <div className="space-y-4">
      {images.length === 0 ? (
        <p className="text-sm text-ink-soft">Este producto aún no tiene imágenes.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, i) => (
            <li key={image.id} className="rounded-card border border-line bg-surface p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-soft">
                {/* Imagen pública del bucket; la tienda la optimiza, aquí basta una vista previa. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={`Imagen ${i + 1}`} className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                    <Star className="size-3" aria-hidden /> Portada
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between">
                {form(image.id, "arriba", `Subir imagen ${i + 1}`, <ArrowUp className="size-4" aria-hidden />, i === 0)}
                {form(image.id, "abajo", `Bajar imagen ${i + 1}`, <ArrowDown className="size-4" aria-hidden />, i === images.length - 1)}
                {form(image.id, "portada", `Hacer portada la imagen ${i + 1}`, <Star className="size-4" aria-hidden />, i === 0)}
                {form(image.id, "quitar", `Quitar imagen ${i + 1}`, <Trash2 className="size-4" aria-hidden />, false, "text-sale-ink")}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormError>{state.error}</FormError>
      <ImageUploader
        action={(data) => subirImagenProducto(productId, data)}
        disabled={images.length >= MAX_IMAGES}
        hint={`JPG, PNG o WebP (se reducen solas). Máximo ${MAX_IMAGES} imágenes; la primera es la portada.`}
      />
    </div>
  );
}

/** Activo y destacado desde el listado. */
export function ProductRowToggles({ id, activo, destacado, nombre }: { id: string; activo: boolean; destacado: boolean; nombre: string }) {
  const [state, action] = useActionState(alternarProducto, initial);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="campo" value="activo" />
        <button type="submit" className={buttonClass("ghost", "sm")} aria-label={`${activo ? "Desactivar" : "Activar"} ${nombre}`}>
          {activo ? "Desactivar" : "Activar"}
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="campo" value="destacado" />
        <button
          type="submit"
          className={buttonClass("ghost", "sm", "gap-1")}
          aria-pressed={destacado}
          aria-label={`${destacado ? "Quitar de" : "Poner en"} destacados: ${nombre}`}
        >
          <Star className={cn("size-4", destacado && "fill-current text-sale")} aria-hidden />
        </button>
      </form>
      {state.error && (
        <p role="alert" className="basis-full text-sm text-sale-ink">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function DeleteProduct({ id, nombre, hasOrders }: { id: string; nombre: string; hasOrders: boolean }) {
  const [state, action] = useActionState(eliminarProducto, initial);
  return (
    <details className="max-w-md rounded-card border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-sale-ink">
        Eliminar “{nombre}”
      </summary>
      <form action={action} className="space-y-3 border-t border-line p-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-ink-soft">
          {hasOrders
            ? "Este producto tiene pedidos, así que no se puede eliminar: desactívalo para ocultarlo de la tienda."
            : "Se eliminan el producto y sus imágenes. Si solo quieres ocultarlo, desactívalo."}
        </p>
        <FormError>{state.error}</FormError>
        <SubmitButton variant="secondary" className="text-sale-ink" pendingLabel="Eliminando…">
          Eliminar definitivamente
        </SubmitButton>
      </form>
    </details>
  );
}

/** Imagen opcional de una categoría (la tienda la usa en las tarjetas del inicio). */
export function CategoryImageManager({ categoryId, imageUrl }: { categoryId: string; imageUrl: string | null }) {
  const [state, action] = useActionState(quitarImagenCategoria, initial);
  return (
    <div className="max-w-md space-y-3">
      {imageUrl ? (
        <div className="space-y-2">
          <div className="aspect-square w-40 overflow-hidden rounded-card border border-line bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Imagen de la categoría" className="size-full object-cover" />
          </div>
          <form action={action}>
            <input type="hidden" name="id" value={categoryId} />
            <button type="submit" className={buttonClass("ghost", "sm", "text-sale-ink")}>
              Quitar imagen
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Sin imagen: la tienda muestra un icono.</p>
      )}
      <FormError>{state.error}</FormError>
      <ImageUploader
        action={(data) => subirImagenCategoria(categoryId, data)}
        multiple={false}
        label={imageUrl ? "Cambiar imagen" : "Subir imagen"}
        hint="Opcional. Si la subes, reemplaza al icono en la tienda."
      />
    </div>
  );
}
