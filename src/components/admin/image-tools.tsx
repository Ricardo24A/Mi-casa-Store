"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, X } from "lucide-react";
import { FormError } from "@/components/ui/form-controls";
import { buttonClass } from "@/components/ui/button";
import { prepareImage } from "@/lib/image-file";
import { cn } from "@/lib/utils";

export type UploadAction = (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

const ACCEPT = "image/jpeg,image/png,image/webp,image/*";

/**
 * Reduce cada imagen en el navegador y la sube UNA por UNA (una petición por archivo: así ninguna
 * pasa del límite de 4 MB de Vercel). Devuelve el primer error, o null si todo salió bien.
 */
export async function uploadImages(
  files: File[],
  upload: UploadAction,
  onProgress?: (done: number, total: number) => void,
  /** true si ya pasaron por `prepareImage` (no se vuelven a comprimir). */
  alreadyPrepared = false,
): Promise<string | null> {
  for (const [i, file] of files.entries()) {
    onProgress?.(i, files.length);
    let toSend = file;
    if (!alreadyPrepared) {
      const prepared = await prepareImage(file);
      if (!prepared.ok) return `${file.name}: ${prepared.error}`;
      toSend = prepared.file;
    }
    const data = new FormData();
    data.set("archivo", toSend);
    const res = await upload(data);
    if (!res.ok) return `${file.name}: ${res.error}`;
  }
  onProgress?.(files.length, files.length);
  return null;
}

/** Botón para agregar imágenes a algo que ya existe (producto o categoría). Actualiza la página al terminar. */
export function ImageUploader({
  action,
  label = "Agregar imágenes",
  multiple = true,
  disabled,
  hint,
}: {
  action: UploadAction;
  label?: string;
  multiple?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;
    setError(undefined);
    startTransition(async () => {
      const failure = await uploadImages(files, action, (done, total) => setProgress(`Subiendo ${Math.min(done + 1, total)} de ${total}…`));
      setProgress(undefined);
      if (failure) setError(failure);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept={ACCEPT} multiple={multiple} onChange={onChange} className="sr-only" tabIndex={-1} />
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => input.current?.click()}
        className={buttonClass("secondary", "md", "gap-2")}
      >
        <ImagePlus className="size-4" aria-hidden />
        {pending ? (progress ?? "Subiendo…") : label}
      </button>
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      <FormError>{error}</FormError>
    </div>
  );
}

export interface PickedImage {
  id: string;
  file: File;
  preview: string;
}

/**
 * Selector de imágenes para el alta (todavía no hay producto): las reduce al elegirlas, muestra una
 * vista previa y permite quitarlas y ordenarlas. La primera es la portada. Se suben al guardar.
 */
export function ImagePicker({
  images,
  onChange,
  max,
}: {
  images: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  max: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);
  // Libera las vistas previas al salir.
  useEffect(() => () => latest.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  async function add(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) return;
    setError(undefined);
    setWorking(true);
    const added: PickedImage[] = [];
    for (const file of files.slice(0, max - images.length)) {
      const prepared = await prepareImage(file);
      if (!prepared.ok) {
        setError(`${file.name}: ${prepared.error}`);
        continue;
      }
      added.push({ id: crypto.randomUUID(), file: prepared.file, preview: URL.createObjectURL(prepared.file) });
    }
    if (files.length > max - images.length) setError(`Máximo ${max} imágenes por producto.`);
    setWorking(false);
    onChange([...images, ...added]);
  }

  function move(index: number, delta: number) {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  }

  function remove(index: number) {
    URL.revokeObjectURL(images[index].preview);
    onChange(images.filter((_, i) => i !== index));
  }

  const small = "inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-bg-alt disabled:opacity-40";
  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept={ACCEPT} multiple onChange={add} className="sr-only" tabIndex={-1} />
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, i) => (
            <li key={image.id} className="rounded-card border border-line bg-surface p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-soft">
                {/* Vista previa local (blob:): next/image no aplica. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.preview} alt={`Imagen ${i + 1}`} className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                    <Star className="size-3" aria-hidden /> Portada
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <button type="button" className={small} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir imagen ${i + 1}`}>
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" className={small} disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar imagen ${i + 1}`}>
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button type="button" className={cn(small, "text-sale-ink")} onClick={() => remove(i)} aria-label={`Quitar imagen ${i + 1}`}>
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={working || images.length >= max}
        onClick={() => input.current?.click()}
        className={buttonClass("secondary", "md", "gap-2")}
      >
        <ImagePlus className="size-4" aria-hidden />
        {working ? "Preparando…" : images.length === 0 ? "Elegir imágenes" : "Agregar más"}
      </button>
      <p className="text-sm text-ink-soft">
        JPG, PNG o WebP. Se reducen solas a 1600 px como máximo (4 MB por imagen). La primera es la portada.
      </p>
      <FormError>{error}</FormError>
    </div>
  );
}
