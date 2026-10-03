import Link from "next/link";

/**
 * Casilla obligatoria "Acepto los Términos y Condiciones y la Política de Privacidad", con los enlaces
 * (se abren en otra pestaña para no perder lo escrito). La validación real es la del servidor (Zod); el
 * `required` del navegador es solo una ayuda. Área táctil de 44 px.
 */
export function AcceptTerms({
  id = "acepta",
  error,
  defaultChecked,
}: {
  id?: string;
  error?: string;
  defaultChecked?: boolean;
}) {
  const link = "font-semibold text-accent underline underline-offset-4 hover:no-underline";
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2 text-sm text-ink">
        <input
          id={id}
          name="acepta"
          type="checkbox"
          required
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-accent"
        />
        <span>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" rel="noopener" className={link}>
            Términos y Condiciones
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" target="_blank" rel="noopener" className={link}>
            Política de Privacidad
          </Link>
          . *
        </span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-sale-ink">
          {error}
        </p>
      )}
    </div>
  );
}
