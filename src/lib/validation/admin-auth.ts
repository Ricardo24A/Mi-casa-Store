import { z } from "zod";
import { uuid } from "./common";

/** Código de una app de autenticación: 6 dígitos. */
export const totpCode = z.string().trim().regex(/^\d{6}$/, "Son 6 dígitos");

export const totpVerifySchema = z.object({
  factorId: uuid,
  code: totpCode,
});
