import { cookies } from "./cookies.ts";
import { privacidad } from "./privacidad.ts";
import { terminos } from "./terminos.ts";
import type { LegalDoc } from "./types.ts";

export { cookies, privacidad, terminos };
export type { LegalDoc };

export const LEGAL_DOCS: Record<LegalDoc["slug"], LegalDoc> = { privacidad, terminos, cookies };

/** Versión de cada documento (la fecha del texto del cliente). Al publicar un texto nuevo, cambia aquí y en el documento. */
export const LEGAL_VERSIONS = {
  privacidad: privacidad.version,
  terminos: terminos.version,
  cookies: cookies.version,
} as const;

/** Rutas públicas de los documentos y su nombre en enlaces (pie de la tienda y de los correos). */
export const LEGAL_LINKS = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
  { href: "/cookies", label: "Cookies" },
] as const;

/**
 * Lo que se guarda al aceptar (registro y checkout): los Términos y la Política de Privacidad con la
 * versión que se mostraba. Máximo 80 caracteres y solo los permitidos por la base de datos.
 */
export function acceptanceVersion(): string {
  return `terminos ${LEGAL_VERSIONS.terminos} + privacidad ${LEGAL_VERSIONS.privacidad}`;
}

export const ACCEPTANCE_VERSION_PATTERN = /^[A-Za-z0-9 ._:/+-]{1,80}$/;
