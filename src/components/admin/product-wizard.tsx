"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { crearProducto, subirImagenProducto } from "@/app/(admin)/admin/(panel)/productos/actions";
import { ImagePicker, uploadImages, type PickedImage } from "@/components/admin/image-tools";
import { ProductFields } from "@/components/admin/product-fields";
import { buttonClass } from "@/components/ui/button";
import { FormError, FormSuccess } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export interface WizardCategory {
  id: string;
  nombre: string;
  activa: boolean;
  hijas: { id: string; nombre: string; activa: boolean }[];
}
export interface WizardTemplate {
  id: string;
  category_id: string;
  nombre: string;
  descripcion_base: string;
  precio_sugerido: number | null;
  prefijo_sku: string | null;
}

const STEPS = ["Categoría", "Subcategoría", "Plantilla", "Detalles"];
const MAX_IMAGES = 8;

function Option({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "lift flex min-h-11 w-full items-center justify-between gap-3 rounded-card border bg-surface px-4 py-3 text-left text-sm font-semibold text-ink",
        selected ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50",
      )}
    >
      {children}
    </button>
  );
}

/** Alta de producto en 4 pasos: categoría, subcategoría, plantilla u "Otro producto (manual)", y detalles con imágenes. */
export function ProductWizard({ categories, templates }: { categories: WizardCategory[]; templates: WizardTemplate[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [rootId, setRootId] = useState<string>();
  const [subId, setSubId] = useState<string>();
  const [template, setTemplate] = useState<WizardTemplate | "manual" | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [banner, setBanner] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const root = categories.find((c) => c.id === rootId);
  const sub = root?.hijas.find((h) => h.id === subId);
  const subTemplates = templates.filter((t) => t.category_id === subId);

  function restart(message?: string) {
    setStep(1);
    setRootId(undefined);
    setSubId(undefined);
    setTemplate(null);
    setImages([]);
    setErrors({});
    setError(undefined);
    setSavedId(undefined);
    setFormKey((k) => k + 1);
    setBanner(message);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subId) return;
    const form = new FormData(event.currentTarget);
    const another = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "otro";
    const text = (name: string) => String(form.get(name) ?? "");
    setErrors({});
    setError(undefined);
    setSavedId(undefined);

    startTransition(async () => {
      const created = await crearProducto({
        categoryId: subId,
        nombre: text("nombre"),
        descripcion: text("descripcion"),
        precio: text("precio"),
        stock: text("stock"),
        sku: text("sku"),
        activo: form.get("activo") ? "on" : "",
        destacado: form.get("destacado") ? "on" : "",
      });
      if (!created.ok) {
        setErrors(created.fieldErrors ?? {});
        setError(created.error);
        return;
      }

      // El producto ya existe; las imágenes se suben una por una.
      if (images.length > 0) {
        const failure = await uploadImages(
          images.map((i) => i.file),
          (data) => subirImagenProducto(created.id, data),
          (done, total) => setProgress(`Subiendo imagen ${Math.min(done + 1, total)} de ${total}…`),
          true,
        );
        setProgress(undefined);
        if (failure) {
          setSavedId(created.id);
          setError(`El producto se guardó, pero una imagen falló: ${failure} Puedes agregarla desde la edición del producto.`);
          return;
        }
      }

      if (another) restart(`“${text("nombre")}” se guardó. Puedes agregar otro producto.`);
      else router.push("/admin/productos");
    });
  }

  const defaults =
    template && template !== "manual"
      ? {
          nombre: template.nombre,
          descripcion: template.descripcion_base,
          precio: template.precio_sugerido === null ? "" : String(template.precio_sugerido).replace(".", ","),
          stock: "0",
          sku: template.prefijo_sku ?? "",
          activo: true,
          destacado: false,
        }
      : { nombre: "", descripcion: "", precio: "", stock: "0", sku: "", activo: true, destacado: false };

  return (
    <div className="max-w-3xl">
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Pasos">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li
              key={label}
              aria-current={step === n ? "step" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                step === n ? "border-accent bg-accent text-white" : n < step ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface text-ink-soft",
              )}
            >
              {n < step ? <Check className="size-4" aria-hidden /> : <span aria-hidden>{n}</span>}
              {label}
            </li>
          );
        })}
      </ol>

      {banner && step === 1 && <div className="mb-4"><FormSuccess>{banner}</FormSuccess></div>}

      {step === 1 && (
        <section aria-labelledby="paso1" className="space-y-3">
          <h2 id="paso1" className="text-xl font-semibold text-ink">1. Elige la categoría</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Aún no hay categorías. <Link href="/admin/categorias/nueva" className="font-semibold text-accent underline">Crea una</Link> primero.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {categories.map((c) => (
                <li key={c.id}>
                  <Option
                    selected={rootId === c.id}
                    onClick={() => {
                      setRootId(c.id);
                      setSubId(undefined);
                      setTemplate(null);
                      setStep(2);
                    }}
                  >
                    <span>{c.nombre}</span>
                    {!c.activa && <span className="text-xs font-normal text-ink-soft">Desactivada</span>}
                  </Option>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 2 && root && (
        <section aria-labelledby="paso2" className="space-y-3">
          <h2 id="paso2" className="text-xl font-semibold text-ink">2. Elige la subcategoría de {root.nombre}</h2>
          {root.hijas.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Esta categoría no tiene subcategorías.{" "}
              <Link href={`/admin/categorias/nueva?padre=${root.id}`} className="font-semibold text-accent underline">Crea una</Link>.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {root.hijas.map((h) => (
                <li key={h.id}>
                  <Option
                    selected={subId === h.id}
                    onClick={() => {
                      setSubId(h.id);
                      setTemplate(null);
                      setStep(3);
                    }}
                  >
                    <span>{h.nombre}</span>
                    {!h.activa && <span className="text-xs font-normal text-ink-soft">Desactivada</span>}
                  </Option>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setStep(1)} className={buttonClass("ghost", "md")}>← Atrás</button>
        </section>
      )}

      {step === 3 && sub && (
        <section aria-labelledby="paso3" className="space-y-3">
          <h2 id="paso3" className="text-xl font-semibold text-ink">3. Elige una plantilla o empieza desde cero</h2>
          <p className="text-sm text-ink-soft">
            Las plantillas rellenan el nombre, la descripción, el precio sugerido y el prefijo del SKU. Todo se puede cambiar.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {subTemplates.map((t) => (
              <li key={t.id}>
                <Option
                  onClick={() => {
                    setTemplate(t);
                    setFormKey((k) => k + 1);
                    setStep(4);
                  }}
                >
                  <span>{t.nombre}</span>
                </Option>
              </li>
            ))}
            <li>
              <Option
                onClick={() => {
                  setTemplate("manual");
                  setFormKey((k) => k + 1);
                  setStep(4);
                }}
              >
                <span>Otro producto (manual)</span>
              </Option>
            </li>
          </ul>
          <button type="button" onClick={() => setStep(2)} className={buttonClass("ghost", "md")}>← Atrás</button>
        </section>
      )}

      {step === 4 && sub && root && (
        <form onSubmit={submit} noValidate className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">4. Detalles del producto</h2>
            <p className="text-sm text-ink-soft">
              {root.nombre} › {sub.nombre}
              {template && template !== "manual" ? ` · Plantilla: ${template.nombre}` : " · Manual"}
            </p>
          </div>

          <div key={formKey}>
            <ProductFields defaults={defaults} errors={errors} />
          </div>
          {errors.categoryId && <p className="text-sm text-sale-ink">{errors.categoryId}</p>}

          <section aria-labelledby="imagenes" className="space-y-3">
            <h3 id="imagenes" className="text-base font-semibold text-ink">Imágenes</h3>
            <ImagePicker images={images} onChange={setImages} max={MAX_IMAGES} />
          </section>

          <FormError>{error}</FormError>
          {savedId && (
            <Link href={`/admin/productos/${savedId}`} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
              Ir a editar el producto
            </Link>
          )}
          {progress && <p role="status" className="text-sm text-ink-soft">{progress}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" value="guardar" disabled={pending} className={buttonClass("primary", "lg")}>
              {pending ? "Guardando…" : "Guardar producto"}
            </button>
            <button type="submit" value="otro" disabled={pending} className={buttonClass("secondary", "lg")}>
              Guardar y agregar otro
            </button>
            <button type="button" disabled={pending} onClick={() => setStep(3)} className={buttonClass("ghost", "lg")}>
              ← Atrás
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
