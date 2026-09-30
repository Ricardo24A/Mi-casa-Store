// Slugs automáticos (categorías y productos). Puro y sin `@/`, para probarlo con node:test.

const MAX_LENGTH = 80;

/** "Decoración y muebles" -> "decoracion-y-muebles". Siempre devuelve un slug válido (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
export function slugify(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** Primer slug libre: `base`, `base-2`, `base-3`... */
export function nextAvailableSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, MAX_LENGTH - 9)}-${Date.now().toString(36)}`;
}
