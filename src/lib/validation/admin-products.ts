import { z } from "zod";
import { text, uuid } from "./common.ts";

/** Precio escrito en un campo de texto: acepta coma o punto, 2 decimales, mayor que 0 y sin tope práctico. */
export const priceInput = z
  .string()
  .trim()
  .min(1, "Escribe un precio")
  .transform((v) => Number(v.replace(",", ".")))
  .pipe(
    z
      .number({ error: "Escribe un precio válido" })
      .finite({ error: "Escribe un precio válido" })
      .multipleOf(0.01, { error: "Usa como máximo 2 decimales" })
      .gt(0, { error: "Debe ser mayor que 0" })
      .max(99_999_999.99, { error: "Es un precio demasiado alto" }),
  );

/** Unidades: entero de 0 o más. */
export const stockInput = z
  .string()
  .trim()
  .regex(/^[0-9]{1,7}$/, "Escribe un número entero de 0 o más")
  .transform(Number);

/** Casilla de formulario: "on" = marcada. */
const checkbox = z.union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()]).transform((v) => v === "on" || v === "true");

/** Campos de un producto (alta y edición). `sku` vacío = sin SKU. */
export const productFormSchema = z.object({
  categoryId: uuid,
  nombre: text(1, 120),
  descripcion: z.string().trim().max(5000, "Máximo 5000 caracteres"),
  precio: priceInput,
  stock: stockInput,
  sku: z.union([text(1, 64), z.literal("").transform(() => null)]),
  activo: checkbox,
  destacado: checkbox,
});

export type ProductForm = z.infer<typeof productFormSchema>;

export const productIdSchema = z.object({ id: uuid });

export const imageActionSchema = z.object({
  productId: uuid,
  imageId: uuid,
  intent: z.enum(["arriba", "abajo", "portada", "quitar"]),
});
