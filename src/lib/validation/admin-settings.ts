import { z } from "zod";
import { normalizeEcPhone } from "../phone-ec.ts";
import { text } from "./common.ts";
import { businessHoursSchema } from "./contact.ts";

const MAX_AMOUNT = 99_999_999.99;
export const MAX_BANK_ACCOUNTS = 10;
export const MAX_PAYMENT_HOURS = 168;

/** Un campo opcional: vacío = sin definir (null). */
const optional = (schema: z.ZodType<string>) => z.union([z.literal(""), schema]).transform((v) => (v === "" ? null : v));

/** Número escrito por una persona: acepta coma decimal; vacío = null. */
function decimal(label: string, opts: { min?: number; max?: number; positive?: boolean; maxDecimals?: number }) {
  return z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") return null;
      const n = Number(raw.replace(",", "."));
      const fail = (message: string) => {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      };
      if (!Number.isFinite(n)) return fail("Escribe un número válido");
      const d = opts.maxDecimals ?? 2;
      if (Math.round(n * 10 ** d) / 10 ** d !== n) return fail(`Usa como máximo ${d} decimales`);
      if (opts.positive && n <= 0) return fail("Debe ser mayor que 0");
      if (opts.min !== undefined && n < opts.min) return fail(`${label} no puede ser menor que ${opts.min}`);
      if (opts.max !== undefined && n > opts.max) return fail(`${label} no puede ser mayor que ${opts.max}`);
      return n;
    });
}

const required = <T extends z.ZodType<number | null>>(schema: T, message: string) =>
  schema.refine((v) => v !== null, message).transform((v) => v as number);

export const bankAccountFormSchema = z.object({
  banco: text(1, 80),
  tipo: z.enum(["ahorros", "corriente"], { error: "Elige el tipo de cuenta" }),
  numero: z.string().trim().regex(/^[0-9]{5,25}$/, "Solo dígitos, entre 5 y 25"),
  titular: text(1, 120),
  identificacion: text(5, 20),
});

/**
 * Teléfono del negocio: vacío = sin definir; si se escribe, se normaliza a solo dígitos en formato
 * nacional (mismas reglas que `valid_ec_phone` en la base de datos).
 */
const phone = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    if (raw === "") return null;
    const r = normalizeEcPhone(raw);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.digits;
  });

const facebookUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https:\/\/[^\s]{4,255}$/.test(v), "Escribe un enlace que empiece con https://")
  .refine((v) => {
    if (v === null) return true;
    try {
      const host = new URL(v).hostname.toLowerCase();
      return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host.endsWith(".fb.com");
    } catch {
      return false;
    }
  }, "Debe ser un enlace de Facebook");

/**
 * Formulario de Configuración. Todo llega como texto del formulario y se valida en el servidor.
 * Nada de lo que se guarda aquí es un precio calculado: son las reglas (envío, descuento por
 * transferencia, plazo) con las que el servidor calcula cada pedido.
 *
 * Vacío = sin definir: el costo de envío, el envío gratis y los datos de contacto pueden quedar
 * vacíos, y la tienda se comporta bien sin ellos.
 */
export const settingsFormSchema = z
  .object({
    nombre_negocio: text(1, 80),
    email_contacto: optional(z.email("Correo no válido").max(254)),
    telefono: phone,
    telefono_secundario: phone,
    direccion: optional(text(1, 200)),
    horario_atencion: businessHoursSchema,
    facebook: facebookUrl,
    horas_limite_pago: required(
      decimal("El plazo", { min: 1, max: MAX_PAYMENT_HOURS, maxDecimals: 0 }),
      "Escribe el plazo en horas",
    ),
    descuento_transferencia_pct: required(
      decimal("El descuento", { min: 0, maxDecimals: 2 }).refine((v) => v === null || v < 100, "Debe ser menor que 100"),
      "Escribe 0 si no hay descuento",
    ),
    costo_envio: decimal("El costo", { min: 0, max: MAX_AMOUNT }),
    envio_gratis_desde: decimal("El monto", { positive: true, max: MAX_AMOUNT }),
    umbral_stock_bajo: required(
      decimal("El umbral", { min: 0, max: 1000, maxDecimals: 0 }),
      "Escribe el umbral de stock bajo",
    ),
    cuentas: z.array(bankAccountFormSchema).max(MAX_BANK_ACCOUNTS, `Máximo ${MAX_BANK_ACCOUNTS} cuentas`),
  })
  .superRefine((v, ctx) => {
    if (v.telefono_secundario !== null) {
      if (v.telefono === null) {
        ctx.addIssue({ code: "custom", path: ["telefono_secundario"], message: "Primero escribe el teléfono principal" });
      } else if (v.telefono === v.telefono_secundario) {
        ctx.addIssue({ code: "custom", path: ["telefono_secundario"], message: "Este número ya está en el otro campo" });
      }
    }
    const seen = new Set<string>();
    v.cuentas.forEach((c, i) => {
      const key = `${c.banco.toLowerCase()}|${c.numero}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["cuentas", i, "numero"], message: "Esta cuenta está repetida" });
      seen.add(key);
    });
    if (v.envio_gratis_desde !== null && v.costo_envio === null) {
      ctx.addIssue({
        code: "custom",
        path: ["costo_envio"],
        message: "Para ofrecer envío gratis desde un monto, define también el costo de envío",
      });
    }
  })
  .transform((v) => ({
    nombre_negocio: v.nombre_negocio,
    email_contacto: v.email_contacto,
    telefono: v.telefono,
    telefono_secundario: v.telefono_secundario,
    direccion: v.direccion,
    horario_atencion: v.horario_atencion,
    cuentas_bancarias: v.cuentas,
    costo_envio: v.costo_envio,
    envio_gratis_desde: v.envio_gratis_desde,
    descuento_transferencia_pct: v.descuento_transferencia_pct,
    horas_limite_pago: v.horas_limite_pago,
    umbral_stock_bajo: v.umbral_stock_bajo,
    enlaces_redes: v.facebook ? { facebook: v.facebook } : {},
  }));

export type SettingsInput = z.infer<typeof settingsFormSchema>;

/**
 * Lee los campos de cuentas del formulario (`cuentas.0.banco`, `cuentas.0.tipo`...) y los agrupa.
 * Se conservan todas las filas (también las vacías) para que el índice de un error coincida con
 * la fila de la pantalla; la persona quita la fila que no quiera.
 */
export function readBankRows(get: (name: string) => string): Record<string, string>[] {
  const count = Math.min(Number(get("cuentas.count")) || 0, MAX_BANK_ACCOUNTS + 5);
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < count; i++) {
    const row = {
      banco: get(`cuentas.${i}.banco`),
      tipo: get(`cuentas.${i}.tipo`),
      numero: get(`cuentas.${i}.numero`),
      titular: get(`cuentas.${i}.titular`),
      identificacion: get(`cuentas.${i}.identificacion`),
    };
    rows.push(row);
  }
  return rows;
}

/** Mensajes de error con la ruta completa (`cuentas.0.numero`) para pintarlos junto a cada campo. */
export function settingsFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
