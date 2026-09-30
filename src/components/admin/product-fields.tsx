import { Field } from "@/components/ui/form-controls";
import { inputClass } from "@/components/ui/form-controls";

export interface ProductDefaults {
  nombre: string;
  descripcion: string;
  precio: string;
  stock: string;
  sku: string;
  activo: boolean;
  destacado: boolean;
}

/**
 * Campos del producto compartidos por el asistente de alta y por la edición.
 * `stockMin` = unidades reservadas por pedidos: el stock no puede bajar de ahí.
 */
export function ProductFields({
  defaults,
  errors,
  stockMin = 0,
  reserved,
}: {
  defaults: ProductDefaults;
  errors: Record<string, string>;
  stockMin?: number;
  reserved?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field className="sm:col-span-2" label="Nombre *" name="nombre" required defaultValue={defaults.nombre} error={errors.nombre} maxLength={120} />
      <div className="sm:col-span-2">
        <label htmlFor="descripcion" className="mb-1 block text-sm font-semibold text-ink">
          Descripción
        </label>
        <textarea id="descripcion" name="descripcion" rows={4} maxLength={5000} defaultValue={defaults.descripcion} className={inputClass} />
        {errors.descripcion && <p className="mt-1 text-sm text-sale-ink">{errors.descripcion}</p>}
      </div>
      <Field
        label="Precio (USD) *"
        name="precio"
        inputMode="decimal"
        required
        defaultValue={defaults.precio}
        error={errors.precio}
        hint="Sin tope. Usa coma o punto, por ejemplo 12,50."
      />
      <Field
        label="Unidades en stock *"
        name="stock"
        inputMode="numeric"
        type="number"
        min={stockMin}
        step={1}
        required
        defaultValue={defaults.stock}
        error={errors.stock}
        hint={
          reserved !== undefined && reserved > 0
            ? `Hay ${reserved} ${reserved === 1 ? "unidad reservada" : "unidades reservadas"} por pedidos: no puedes dejar menos.`
            : undefined
        }
      />
      <Field label="SKU (opcional)" name="sku" defaultValue={defaults.sku} error={errors.sku} maxLength={64} />
      <div className="flex flex-col justify-end gap-1">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="activo" defaultChecked={defaults.activo} className="size-5 accent-accent" />
          <span className="text-sm text-ink">Activo (visible en la tienda)</span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="destacado" defaultChecked={defaults.destacado} className="size-5 accent-accent" />
          <span className="text-sm text-ink">Destacado (sale en “Más populares”)</span>
        </label>
      </div>
    </div>
  );
}
