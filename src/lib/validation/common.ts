import { z } from "zod";

/** Texto sin espacios sobrantes y con largo acotado. */
export const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

/** Dinero en USD con hasta 2 decimales. */
export const money = z
  .number()
  .finite()
  .multipleOf(0.01)
  .refine((v) => v >= 0, "No puede ser negativo");

/** Precio de producto: sin tope, el dueño decide cuánto vale cada producto; solo debe ser mayor que 0. */
export const price = money.refine((v) => v > 0, "Debe ser mayor que 0");

export const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones");

export const uuid = z.uuid();
