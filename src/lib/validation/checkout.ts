import { z } from "zod";
import { PROVINCIAS } from "@/config/ecuador";
import { text, uuid } from "./common";
import { phoneSchema } from "./account";

/** Dirección nueva escrita en el checkout. Quién recibe y el teléfono salen de los datos de contacto. */
export const checkoutAddressSchema = z.object({
  etiqueta: z.union([text(1, 40), z.literal("").transform(() => "Principal")]),
  provincia: z.enum(PROVINCIAS, { error: "Elige una provincia" }),
  ciudad: text(1, 80),
  direccion: text(5, 200),
  referencia: z.union([text(1, 200), z.literal("").transform(() => null)]),
});

/**
 * Entrada de `crearPedido`. Solo llegan IDs y cantidades: nombres, precios, descuentos, envío y
 * total los calcula el servidor desde la base de datos (nunca se confía en el navegador).
 * La dirección es una guardada (`addressId`) o una nueva (`address`), no ambas.
 */
export const checkoutInputSchema = z
  .object({
    items: z
      .array(z.object({ productId: uuid, cantidad: z.number().int().min(1).max(100) }))
      .min(1, "Tu carrito está vacío")
      .max(50),
    nombre: text(2, 120),
    telefono: phoneSchema,
    addressId: uuid.optional(),
    address: checkoutAddressSchema.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.addressId) !== Boolean(v.address), {
    path: ["address"],
    message: "Elige o escribe una dirección de envío",
  });

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
