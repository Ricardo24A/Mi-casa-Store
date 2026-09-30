import { z } from "zod";
import { text, uuid } from "./common";

/** Campos del formulario de categoría. `parentId` vacío = categoría de primer nivel. */
export const categoryFormSchema = z.object({
  nombre: text(1, 80),
  parentId: z.union([uuid, z.literal("").transform(() => null)]),
});

export const categoryIdSchema = z.object({ id: uuid });

export const categoryRowActionSchema = z.object({
  id: uuid,
  intent: z.enum(["alternar", "arriba", "abajo"]),
});
