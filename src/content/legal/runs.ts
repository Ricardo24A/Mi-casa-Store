import type { Run } from "./types.ts";

/** Qué se muestra si no se pudo leer el plazo de Configuración (nunca un número inventado). */
export const PLAZO_NO_DISPONIBLE = "el número de horas indicado al generar su pedido";

/** "48 horas", "1 hora". */
export function plazoTexto(horas: number | null): string {
  if (horas === null) return PLAZO_NO_DISPONIBLE;
  return `${horas} ${horas === 1 ? "hora" : "horas"}`;
}

export function runText(run: Run, horas: number | null): string {
  if (typeof run === "string") return run;
  if ("plazo" in run) return plazoTexto(horas);
  if ("b" in run) return run.b;
  return run.i;
}

export const runsText = (runs: Run[], horas: number | null) => runs.map((r) => runText(r, horas)).join("");
