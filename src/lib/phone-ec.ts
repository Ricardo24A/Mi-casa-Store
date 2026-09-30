/**
 * Teléfonos del NEGOCIO en Ecuador. Se guardan normalizados: solo dígitos, formato nacional,
 * sin espacios, guiones, paréntesis ni +593.
 *  - Celular: 10 dígitos, `09` + 8 dígitos (el tercero de 1 a 9).
 *  - Fijo: 9 dígitos, código de provincia `02` a `07` + 7 dígitos.
 * La base de datos tiene la misma regla (`valid_ec_phone`, migración 18): si se cambia una, cambiar la otra.
 * (No es la regla del teléfono que escribe el comprador en el checkout, que es más flexible.)
 */

export type EcPhoneKind = "celular" | "fijo";

export type EcPhoneResult = { ok: true; digits: string; kind: EcPhoneKind } | { ok: false; error: string };

export const CELLPHONE_ERROR = "Un celular de Ecuador tiene 10 dígitos y empieza con 09";
export const LANDLINE_ERROR = "Un fijo tiene 9 dígitos con el código de provincia";

const UP = "01234567890123456789";
const DOWN = "98765432109876543210";

const CELLPHONE = /^09[1-9][0-9]{7}$/;
const LANDLINE = /^0[2-7][0-9]{7}$/;

/** Todos los dígitos iguales, o una secuencia obvia (0123456789, 12345678, 98765432...). */
function looksFake(national: string): boolean {
  const tail = national.slice(2); // tras el 09 (8 dígitos) o el código de provincia (7)
  const same = (s: string) => s.split("").every((c) => c === s[0]);
  if (same(national.slice(1)) || same(tail)) return true;
  const run = (s: string) => UP.includes(s) || DOWN.includes(s);
  // Una secuencia de 7 dígitos en un fijo (por ejemplo 234 5678) es un número posible; se rechazan
  // las de 8 en un celular y las que ocupan todo el número.
  return run(national) || (tail.length >= 8 && run(tail));
}

/** Acepta las variantes habituales y devuelve el número nacional de solo dígitos, o un error en español. */
export function normalizeEcPhone(input: string): EcPhoneResult {
  const raw = input.trim();
  if (/[^\d\s()+.-]/.test(raw)) return { ok: false, error: "Usa solo números; sin letras ni otros símbolos" };
  if (raw.lastIndexOf("+") > 0) return { ok: false, error: "El + solo puede ir al inicio, como en +593" };

  let digits = raw.replace(/\D/g, "");
  if (digits === "") return { ok: false, error: "Escribe el número de teléfono" };

  if (raw.startsWith("+") || digits.startsWith("593")) {
    if (!digits.startsWith("593")) return { ok: false, error: "Solo se aceptan números de Ecuador (+593)" };
    const rest = digits.slice(3);
    // "+593 99…" y "+593 099…" significan lo mismo
    digits = rest.startsWith("0") ? rest : `0${rest}`;
  }

  if (digits.length === 10 && !CELLPHONE.test(digits)) return { ok: false, error: CELLPHONE_ERROR };
  if (digits.length === 9 && digits.startsWith("09")) return { ok: false, error: CELLPHONE_ERROR };
  if (digits.length === 9 && !LANDLINE.test(digits)) {
    return { ok: false, error: "El código de provincia de un fijo va de 02 a 07, seguido de 7 dígitos" };
  }
  if (digits.length !== 10 && digits.length !== 9) {
    if (digits.startsWith("09")) return { ok: false, error: CELLPHONE_ERROR };
    if (/^0[2-7]/.test(digits)) return { ok: false, error: LANDLINE_ERROR };
    return { ok: false, error: "Escribe un celular (10 dígitos, empieza con 09) o un fijo (9 dígitos con código de provincia)" };
  }

  if (looksFake(digits)) return { ok: false, error: "Este número no parece real: tiene dígitos repetidos o en secuencia" };
  return { ok: true, digits, kind: digits.length === 10 ? "celular" : "fijo" };
}

/** ¿Es un número ya normalizado y válido? (lo que hay guardado en la base de datos) */
export function isNormalizedEcPhone(value: string): boolean {
  const r = normalizeEcPhone(value);
  return r.ok && r.digits === value;
}

/** Formato visual de un número normalizado: celular 099 123 4567, fijo (04) 234 5678. */
export function formatEcPhone(digits: string): string {
  if (CELLPHONE.test(digits)) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (LANDLINE.test(digits)) return `(${digits.slice(0, 2)}) ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return digits;
}

/**
 * Da formato mientras se escribe. Sin separadores colgantes al final, y si la persona borra solo un
 * separador se borra también el dígito anterior (si no, el formato lo volvería a poner y no se podría borrar).
 * Lo que empieza con + o 593 se deja como se escribió: se normaliza al guardar.
 */
export function formatEcPhoneInput(raw: string, previous = ""): string {
  if (raw.trim().startsWith("+") || raw.replace(/\D/g, "").startsWith("593")) return raw;
  let d = raw.replace(/\D/g, "");
  if (raw.length < previous.length && d === previous.replace(/\D/g, "")) d = d.slice(0, -1);
  d = d.slice(0, 10);
  if (d.startsWith("09")) {
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
  }
  if (/^0[2-7]/.test(d) && d.length >= 2) {
    const area = `(${d.slice(0, 2)})`;
    const rest = [d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(" ");
    return rest ? `${area} ${rest}` : area;
  }
  return d;
}

/** `tel:` con +593 y el número sin el 0 inicial. Solo para números normalizados y válidos. */
export function telHref(digits: string): string {
  return `tel:+593${digits.slice(1)}`;
}

/** `wa.me` con 593 y el número sin el 0 inicial, solo para celulares (un fijo no tiene WhatsApp). */
export function whatsappHref(digits: string): string | null {
  return CELLPHONE.test(digits) ? `https://wa.me/593${digits.slice(1)}` : null;
}
