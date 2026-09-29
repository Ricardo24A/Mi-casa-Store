import { z } from "zod";
import { text, uuid } from "./common";

export const shippingAddressSchema = z.object({
  provincia: text(1, 80),
  ciudad: text(1, 80),
  direccion: text(5, 200),
  referencia: text(0, 200).optional(),
});

/**
 * Entrada del checkout. Solo llegan IDs y cantidades: nombres, precios, descuentos, envío y
 * total los calcula el servidor desde la base de datos (nunca se confía en el cliente).
 */
export const checkoutSchema = z
  .object({
    contacto_nombre: text(1, 120),
    contacto_email: z.email().max(254),
    // Ecuador: 09XXXXXXXX o +593 9XXXXXXXX.
    contacto_telefono: z
      .string()
      .trim()
      .regex(/^(\+593|0)\s?[0-9][0-9\s-]{7,12}$/, "Teléfono inválido"),
    documento: text(5, 20).optional(),
    direccion_envio: shippingAddressSchema,
    cupon: z.string().trim().toUpperCase().max(32).optional(),
    notas: text(0, 1000).optional(),
    items: z
      .array(z.object({ product_id: uuid, cantidad: z.number().int().min(1).max(100) }))
      .min(1)
      .max(50),
  })
  .strict();

export const proofReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("aprobar"), proof_id: uuid }),
  z.object({ decision: z.literal("rechazar"), proof_id: uuid, motivo: text(3, 500) }),
]);

export type CheckoutInput = z.infer<typeof checkoutSchema>;
