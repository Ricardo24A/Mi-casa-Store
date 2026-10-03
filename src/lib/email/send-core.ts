import { oneLine, type RenderedEmail } from "./render.ts";
import type { EmailType } from "./templates.ts";

/**
 * Envío de un correo, sin dependencias de servidor (se prueba con node --test; el envío real, el
 * registro en la base y la clave de Resend se inyectan desde `mailer.ts`).
 *
 * Garantías:
 *  - NUNCA lanza: cualquier fallo (armar el correo, registrar, enviar) termina en "fallido" o en un
 *    mensaje de consola. Enviar un correo no puede romper el flujo que lo originó, que ya se guardó.
 *  - Idempotencia: cada (tipo, referencia, destinatario) se reclama en `email_log` antes de enviar; si ya
 *    estaba reclamado, no se envía otra vez.
 *  - Un solo reintento corto, solo ante 429, 5xx o error de red. Nada de bucles.
 *  - Sin RESEND_API_KEY: modo simulación; se registra el tipo y el destinatario enmascarado, no el contenido.
 *  - Nada se omite en silencio: un correo sin destinatario válido deja una fila "omitido" con el motivo en
 *    `email_log` (migración 23) y una línea en el registro del servidor, sin datos personales.
 *  - Varios correos de un mismo evento (cliente y dueño) salen en orden, con una pausa corta entre ellos
 *    (Resend limita las peticiones por segundo); un 429 se reintenta una sola vez.
 */

export type EmailStatus = "enviado" | "fallido" | "simulado" | "omitido";
export type Outcome = EmailStatus | "duplicado" | "omitido";

export interface OutgoingEmail extends RenderedEmail {
  from: string;
  to: string;
  /** Mismo valor para el mismo evento: Resend lo usa para no repetir un envío ya aceptado. */
  idempotencyKey: string;
}

export type TransportResult = { ok: true } | { ok: false; status?: number; error: string };

export interface EmailJob {
  tipo: EmailType;
  /** Identifica el evento: la referencia del pedido, o el id del comprobante o del mensaje. */
  referencia: string;
  /** Destinatario real (el de la cuenta o el del dueño). */
  to: string | null;
  /** Qué decir en el registro si no hay destinatario válido (p. ej. cómo configurarlo). */
  omitReason?: string;
  build: () => Promise<RenderedEmail> | RenderedEmail;
}

export interface EmailDeps {
  from: string;
  /** Solo pruebas: todo se entrega a esta dirección (el plan de prueba de Resend solo entrega a la del dueño de la cuenta). */
  testTo: string | null;
  /** null = modo simulación (sin clave de Resend). */
  transport: ((email: OutgoingEmail) => Promise<TransportResult>) | null;
  /** id = null si el registro no está disponible (no se bloquea el envío por eso). */
  claim(tipo: EmailType, referencia: string, to: string): Promise<{ duplicate: boolean; id: string | null }>;
  finish(id: string, estado: EmailStatus, error: string | null): Promise<void>;
  sleep(ms: number): Promise<void>;
  log(message: string): void;
}

export const RETRY_DELAY_MS = 1500;
/** Pausa entre dos correos seguidos de un mismo evento (Resend admite pocas peticiones por segundo). */
export const PAUSE_BETWEEN_EMAILS_MS = 700;

/** a***@g***.com: suficiente para depurar, sin guardar la dirección. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`.slice(0, 120);
}

const looksLikeEmail = (value: string) => /^[^\s@<>]{1,64}@[^\s@<>]{1,253}\.[A-Za-z]{2,63}$/.test(value);

function retryable(r: { ok: false; status?: number }): boolean {
  return r.status === undefined || r.status === 429 || r.status >= 500;
}

function shortError(r: { error: string; status?: number }): string {
  return oneLine(`${r.status ?? "red"}: ${r.error}`, 200);
}

export async function processEmail(job: EmailJob, deps: EmailDeps): Promise<Outcome> {
  let claimId: string | null = null;
  const finish = async (estado: EmailStatus, error: string | null) => {
    if (!claimId) return;
    try {
      await deps.finish(claimId, estado, error);
    } catch {
      deps.log(`[email] no se pudo actualizar el registro (${job.tipo})`);
    }
  };

  try {
    const to = job.to?.trim() ?? "";
    if (!looksLikeEmail(to)) {
      const reason = oneLine(
        job.omitReason ?? (to === "" ? "sin destinatario" : "destinatario con formato no válido"),
        200,
      );
      // Deja constancia en la base (una fila por evento, sin dirección) y en el registro del servidor.
      try {
        const claim = await deps.claim(job.tipo, job.referencia, to);
        if (!claim.duplicate && claim.id) await deps.finish(claim.id, "omitido", reason);
      } catch {
        deps.log(`[email] no se pudo registrar el motivo de la omisión (${job.tipo})`);
      }
      deps.log(`[email:omitido] tipo=${job.tipo} motivo=${reason}`);
      return "omitido";
    }

    try {
      const claim = await deps.claim(job.tipo, job.referencia, to);
      if (claim.duplicate) {
        deps.log(`[email:duplicado] tipo=${job.tipo} destinatario=${maskEmail(to)}`);
        return "duplicado";
      }
      claimId = claim.id;
    } catch {
      // Sin registro no hay protección contra duplicados, pero el aviso es más importante que perderlo.
      deps.log(`[email] registro no disponible (${job.tipo}); se envía sin él`);
    }

    let rendered: RenderedEmail;
    try {
      rendered = await job.build();
    } catch {
      await finish("fallido", "no se pudo armar el correo");
      deps.log(`[email:fallido] tipo=${job.tipo} no se pudo armar el correo`);
      return "fallido";
    }

    const recipient = deps.testTo && looksLikeEmail(deps.testTo) ? deps.testTo : to;
    const subject = deps.testTo ? `[Prueba para ${maskEmail(to)}] ${rendered.subject}` : rendered.subject;

    if (!deps.transport) {
      await finish("simulado", null);
      deps.log(`[email:simulado] tipo=${job.tipo} destinatario=${maskEmail(recipient)}`);
      return "simulado";
    }

    const email: OutgoingEmail = {
      ...rendered,
      subject,
      from: deps.from,
      to: recipient,
      idempotencyKey: oneLine(`${job.tipo}:${job.referencia}:${to}`, 250),
    };

    let result = await deps.transport(email);
    if (!result.ok && retryable(result)) {
      await deps.sleep(RETRY_DELAY_MS);
      result = await deps.transport(email);
    }

    if (result.ok) {
      await finish("enviado", null);
      deps.log(`[email:enviado] tipo=${job.tipo} destinatario=${maskEmail(recipient)}`);
      return "enviado";
    }
    await finish("fallido", shortError(result));
    deps.log(`[email:fallido] tipo=${job.tipo} destinatario=${maskEmail(recipient)} ${shortError(result)}`);
    return "fallido";
  } catch {
    // Último recurso: nada de lo anterior puede propagarse al flujo principal.
    try {
      await finish("fallido", "error inesperado");
      deps.log(`[email:fallido] tipo=${job.tipo} error inesperado`);
    } catch {
      /* nada más que hacer */
    }
    return "fallido";
  }
}

/**
 * Los correos de UN evento, en orden y con una pausa corta entre ellos. La pausa solo se hace si el
 * anterior llegó a pedir un envío a Resend (enviado o fallido); omitidos, duplicados y simulados no la necesitan.
 * Cada correo es independiente: que uno falle no impide intentar el siguiente.
 */
export async function processEmails(jobs: EmailJob[], deps: EmailDeps, pauseMs = PAUSE_BETWEEN_EMAILS_MS): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const job of jobs) {
    const previous = outcomes[outcomes.length - 1];
    if (previous === "enviado" || previous === "fallido") {
      try {
        await deps.sleep(pauseMs);
      } catch {
        /* una pausa que falla no impide enviar */
      }
    }
    outcomes.push(await processEmail(job, deps));
  }
  return outcomes;
}

/** Ejecuta cualquier trabajo de correo sin dejar que un error llegue a quien lo programó. */
export async function safely(work: () => Promise<unknown>, log: (message: string) => void, label: string): Promise<void> {
  try {
    await work();
  } catch (error) {
    // Solo el tipo de error: su mensaje podría traer datos de la solicitud.
    let kind = "desconocido";
    if (error instanceof Error) kind = error.name;
    try {
      log(`[email:fallido] ${label} error inesperado (${kind})`);
    } catch {
      /* nada más que hacer */
    }
  }
}
