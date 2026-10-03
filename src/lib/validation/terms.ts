import { z } from "zod";
import "./common.ts"; // mensajes de Zod en español

/**
 * Casilla obligatoria "Acepto los Términos y Condiciones y la Política de Privacidad". La regla vive aquí
 * (sin alias, para probarla) y la usan el registro (casilla de HTML: llega "on") y el checkout (llega true).
 * El servidor la valida siempre: el `required` del navegador es solo una ayuda.
 */
export const ACCEPT_TERMS_ERROR = "Para continuar, acepta los Términos y Condiciones y la Política de Privacidad";

export const acceptTermsField = z.literal("on", { error: ACCEPT_TERMS_ERROR });
export const acceptTermsBoolean = z.literal(true, { error: ACCEPT_TERMS_ERROR });
