import { z } from "zod";
import { money, text } from "./common";

export const bankAccountSchema = z.object({
  banco: text(1, 80),
  tipo: z.enum(["ahorros", "corriente"]),
  numero: z.string().trim().regex(/^[0-9]{5,25}$/, "Solo dígitos"),
  titular: text(1, 120),
  identificacion: text(5, 20),
});

export const storeSettingsSchema = z
  .object({
    nombre_negocio: text(1, 80),
    email_contacto: z.email().max(254).nullable(),
    telefono: text(5, 30).nullable(),
    direccion: text(1, 200).nullable(),
    cuentas_bancarias: z.array(bankAccountSchema).max(10),
    costo_envio: money,
    // null = sin envío gratis
    envio_gratis_desde: money.refine((v) => v > 0, "Debe ser mayor que 0").nullable(),
    // 0 = descuento por transferencia desactivado
    descuento_transferencia_pct: z.number().min(0).max(100).multipleOf(0.01),
    horas_limite_pago: z.number().int().min(1).max(336),
  })
  .strict();

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
