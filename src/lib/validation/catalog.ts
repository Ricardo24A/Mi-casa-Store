import { z } from "zod";
import { price, slug, text, uuid } from "./common";

export const categorySchema = z
  .object({
    parent_id: uuid.nullable(),
    nombre: text(1, 80),
    slug,
    orden: z.number().int().min(0).default(0),
  })
  .strict();

export const productTemplateSchema = z
  .object({
    category_id: uuid,
    nombre: text(1, 120),
    descripcion_base: text(0, 2000).default(""),
    precio_sugerido: price.nullable(),
    prefijo_sku: text(1, 32).nullable(),
  })
  .strict();

export const productSchema = z
  .object({
    category_id: uuid,
    nombre: text(1, 120),
    slug,
    descripcion: text(0, 5000).default(""),
    precio: price,
    stock: z.number().int().min(0),
    sku: text(1, 64).nullable(),
    activo: z.boolean().default(true),
    destacado: z.boolean().default(false),
  })
  .strict();

export const discountSchema = z
  .object({
    nombre: text(1, 120),
    tipo: z.enum(["porcentaje", "monto_fijo"]),
    valor: price,
    alcance: z.enum(["producto", "categoria", "tienda"]),
    target_id: uuid.nullable(),
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "3 a 32 caracteres: letras, números, _ o -")
      .nullable(),
    inicia: z.iso.datetime({ offset: true }),
    termina: z.iso.datetime({ offset: true }).nullable(),
    activo: z.boolean().default(true),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.tipo === "porcentaje" && d.valor > 100) {
      ctx.addIssue({ code: "custom", path: ["valor"], message: "Máximo 100%" });
    }
    if (d.alcance === "tienda" && d.target_id !== null) {
      ctx.addIssue({ code: "custom", path: ["target_id"], message: "La tienda completa no lleva destino" });
    }
    if (d.alcance !== "tienda" && d.target_id === null) {
      ctx.addIssue({ code: "custom", path: ["target_id"], message: "Elige un producto o categoría" });
    }
    if (d.termina && new Date(d.termina) <= new Date(d.inicia)) {
      ctx.addIssue({ code: "custom", path: ["termina"], message: "Debe ser posterior al inicio" });
    }
  });

export type ProductInput = z.infer<typeof productSchema>;
export type DiscountInput = z.infer<typeof discountSchema>;
