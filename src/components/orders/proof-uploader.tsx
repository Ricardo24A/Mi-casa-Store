"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { subirComprobante } from "@/app/(tienda)/confirmacion/actions";
import { buttonClass } from "@/components/ui/button";
import { FormError, FormSuccess } from "@/components/ui/form-controls";
import { prepareProofFile } from "@/lib/proof-file";

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/**
 * Subida del comprobante (JPG, PNG o PDF). Las fotos se reducen en el navegador para respetar el
 * límite de 4 MB; el servidor vuelve a validar el tipo real y el tamaño.
 */
export function ProofUploader({
  referencia,
  mode = "subir",
}: {
  referencia: string;
  mode?: "subir" | "reemplazar";
}) {
  const replacing = mode === "reemplazar";
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; bytes: number } | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return setError("Elige el archivo de tu comprobante.");
    setError(undefined);

    startTransition(async () => {
      const prepared = await prepareProofFile(file);
      if (!prepared.ok) return setError(prepared.error);

      const data = new FormData();
      data.set("archivo", prepared.file);
      const res = await subirComprobante(referencia, data);
      if (res.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      if (res.code === "login") return void router.push(`/login?next=${encodeURIComponent("/cuenta")}`);
      setError(res.error);
    });
  }

  if (done) {
    return (
      <FormSuccess>
        {replacing ? "Listo, reemplazamos tu comprobante. Lo revisaremos." : "Recibimos tu comprobante. Lo revisaremos y te avisaremos."}
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <label htmlFor={`archivo-${referencia}`} className="mb-1 block text-sm font-semibold text-ink">
          {replacing ? "Nuevo comprobante (reemplaza al anterior)" : "Comprobante de la transferencia"}
        </label>
        <input
          ref={input}
          id={`archivo-${referencia}`}
          type="file"
          accept="image/*,application/pdf"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setChosen(f ? { name: f.name, bytes: f.size } : null);
            setError(undefined);
          }}
          className="block w-full min-h-11 cursor-pointer rounded-lg border border-line bg-surface text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:bg-accent-soft file:px-4 file:font-semibold file:text-accent"
        />
        <p className="mt-1 text-sm text-ink-soft">
          Foto (JPG o PNG) o PDF, hasta 4 MB. Las fotos grandes se reducen solas.
          {chosen && (
            <>
              {" "}
              Elegido: <span className="font-semibold text-ink">{chosen.name}</span> ({size(chosen.bytes)}).
            </>
          )}
        </p>
      </div>
      <FormError>{error}</FormError>
      <button type="submit" disabled={pending || !chosen} className={buttonClass("primary", "md")}>
        <FileUp className="size-4" aria-hidden />
        {pending ? "Subiendo…" : replacing ? "Reemplazar comprobante" : "Subir comprobante"}
      </button>
    </form>
  );
}
