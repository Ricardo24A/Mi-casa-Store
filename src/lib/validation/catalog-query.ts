import { z } from "zod";

export const SORT_OPTIONS = ["relevancia", "precio-asc", "precio-desc", "nombre"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  relevancia: "Más recientes",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  nombre: "Nombre A-Z",
};

export const Q_MAX_LENGTH = 60;

/**
 * Deja el texto de búsqueda seguro para usarlo en un filtro `ilike` de PostgREST:
 * quita los caracteres que rompen la sintaxis del filtro (coma, paréntesis, comillas,
 * barra invertida, asterisco, dos puntos) y colapsa espacios.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[,()"'\\*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Q_MAX_LENGTH);
}

/** Escapa `%` y `_` (comodines de LIKE) y la barra de escape, para buscarlos literalmente. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const price = z.coerce.number().finite().min(0).max(1_000_000);

const schema = z.object({
  q: z
    .string()
    .max(200)
    .transform(sanitizeSearch)
    .transform((s) => (s.length > 0 ? s : undefined))
    .optional(),
  orden: z.enum(SORT_OPTIONS).default("relevancia"),
  min: price.optional(),
  max: price.optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

export type CatalogQuery = z.infer<typeof schema>;

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Valida los `searchParams` de la URL. Nunca lanza: un parámetro inválido se ignora y
 * vuelve a su valor por defecto (la URL la puede escribir cualquiera).
 */
export function parseCatalogQuery(raw: RawParams): CatalogQuery {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const pick = (key: string) => {
    const single = schema.shape[key as keyof typeof schema.shape];
    const value = first(raw[key]);
    if (value === undefined || value === "") return undefined;
    const parsed = single.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  };

  const min = pick("min") as number | undefined;
  const max = pick("max") as number | undefined;

  return {
    q: pick("q") as string | undefined,
    orden: (pick("orden") as SortOption | undefined) ?? "relevancia",
    min,
    // Si el rango llega invertido, se ignora el máximo.
    max: min !== undefined && max !== undefined && max < min ? undefined : max,
    pagina: (pick("pagina") as number | undefined) ?? 1,
  };
}
