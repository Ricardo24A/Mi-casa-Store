import { z } from "zod";
import { localToIso } from "../discount-rules.ts";
import { text, uuid } from "./common.ts";

const MAX_AMOUNT = 99_999_999.99;

/**
 * Formulario de un descuento. Solo trae el TIPO y el VALOR de la rebaja: el precio final nunca viene
 * del navegador (lo calcula el servidor con `priceProduct`). Las fechas se escriben en hora de Ecuador.
 */
export const discountFormSchema = z
  .object({
    nombre: text(1, 120),
    tipo: z.enum(["porcentaje", "monto_fijo"], { error: "Elige el tipo de descuento" }),
    valor: z.string().trim().min(1, "Escribe el valor"),
    alcance: z.enum(["tienda", "categoria", "producto"], { error: "Elige a qué se aplica" }),
    targetId: z.union([uuid, z.literal("")]),
    inicia: z.string().trim(),
    termina: z.string().trim(),
    activo: z.union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()]).transform((v) => v === "on" || v === "true"),
  })
  .transform((v, ctx) => {
    const fail = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };

    // Valor: hasta 2 decimales; porcentaje entre 0 y 100 (sin incluirlos); monto fijo mayor que 0.
    const valor = Number(v.valor.replace(",", "."));
    if (!Number.isFinite(valor)) return fail("valor", "Escribe un número válido");
    if (Math.round(valor * 100) / 100 !== valor) return fail("valor", "Usa como máximo 2 decimales");
    if (valor <= 0) return fail("valor", "Debe ser mayor que 0");
    if (v.tipo === "porcentaje" && valor >= 100) return fail("valor", "Un porcentaje debe ser menor que 100");
    if (v.tipo === "monto_fijo" && valor > MAX_AMOUNT) return fail("valor", "Es un monto demasiado alto");

    // Destino: obligatorio salvo para toda la tienda.
    if (v.alcance === "tienda" && v.targetId !== "") return fail("targetId", "Toda la tienda no lleva destino");
    if (v.alcance !== "tienda" && v.targetId === "") {
      return fail("targetId", v.alcance === "categoria" ? "Elige la categoría" : "Elige el producto");
    }

    // Fechas (hora de Ecuador). Inicio vacío = desde ahora; fin vacío = sin fecha de fin.
    const inicia = v.inicia === "" ? null : localToIso(v.inicia);
    if (v.inicia !== "" && !inicia) return fail("inicia", "Fecha de inicio no válida");
    const termina = v.termina === "" ? null : localToIso(v.termina);
    if (v.termina !== "" && !termina) return fail("termina", "Fecha de fin no válida");
    if (termina && inicia && new Date(termina) <= new Date(inicia)) return fail("termina", "El fin debe ser posterior al inicio");
    if (termina && !inicia && new Date(termina) <= new Date()) return fail("termina", "El fin debe ser en el futuro");

    return {
      nombre: v.nombre,
      tipo: v.tipo,
      valor,
      alcance: v.alcance,
      target_id: v.alcance === "tienda" ? null : v.targetId,
      inicia,
      termina,
      activo: v.activo,
    };
  });

export type DiscountInput = z.infer<typeof discountFormSchema>;

export const discountIdSchema = z.object({ id: uuid });
