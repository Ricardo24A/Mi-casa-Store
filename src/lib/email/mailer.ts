import "server-only";
import { formatEcPhone, isNormalizedEcPhone } from "@/lib/phone-ec";
import { hmacHex } from "@/lib/hmac";
import { getEmailConfig } from "@/lib/server-env";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BankAccountInfo } from "./render.ts";
import { maskEmail, processEmail, type EmailDeps, type EmailJob, type OutgoingEmail, type Outcome, type TransportResult } from "./send-core.ts";
import type { TemplateContext } from "./templates.ts";

/**
 * Conexión de los correos con el mundo real: Resend (por fetch, sin dependencias), el registro
 * `email_log` (migración 22, solo service_role) y los datos de `store_settings`. La lógica vive en
 * `send-core.ts` y las plantillas en `templates.ts`.
 */

const RESEND_URL = "https://api.resend.com/emails";
const TEST_SENDER = "onboarding@resend.dev";
let warnedSimulation = false;

async function resendTransport(apiKey: string, email: OutgoingEmail): Promise<TransportResult> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({ from: email.from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    let detail = "";
    try {
      const body = (await res.json()) as { name?: string; message?: string };
      detail = `${body.name ?? ""} ${body.message ?? ""}`.trim();
    } catch {
      /* respuesta sin JSON */
    }
    return { ok: false, status: res.status, error: detail || "respuesta de error" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : "error de red" };
  }
}

export function buildDeps(storeName: string): EmailDeps {
  const config = getEmailConfig();
  if (!config.apiKey && !warnedSimulation && process.env.NODE_ENV === "production") {
    warnedSimulation = true;
    console.warn("[email] RESEND_API_KEY no está definida: los correos quedan en modo simulación.");
  }
  if (config.testTo && process.env.NODE_ENV === "production") {
    console.warn("[email] EMAIL_TEST_TO está definida en producción: TODOS los correos se redirigen a esa dirección.");
  }
  const apiKey = config.apiKey;
  return {
    from: config.from ?? `${storeName} <${TEST_SENDER}>`,
    testTo: config.testTo,
    transport: apiKey ? (email) => resendTransport(apiKey, email) : null,
    async claim(tipo, referencia, to) {
      const { data, error } = await createAdminClient().rpc("email_log_claim", {
        p_tipo: tipo,
        p_referencia: referencia,
        // La base solo guarda esta huella y la versión enmascarada, nunca la dirección.
        p_hash: hmacHex("email-log", to.trim().toLowerCase()),
        p_mascara: maskEmail(to),
      });
      if (error) throw new Error(error.code ?? "rpc");
      return typeof data === "string" ? { duplicate: false, id: data } : { duplicate: true, id: null };
    },
    async finish(id, estado, error) {
      const { error: rpcError } = await createAdminClient().rpc("email_log_finish", { p_id: id, p_estado: estado, p_error: error });
      if (rpcError) throw new Error(rpcError.code ?? "rpc");
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message) => console.log(message),
  };
}

// ---------------------------------------------------------------------------
// Datos reales de la tienda y de los pedidos
// ---------------------------------------------------------------------------

export interface StoreEmailData {
  context: TemplateContext;
  cuentas: BankAccountInfo[];
  ownerTo: string | null;
  nombre: string;
}

/** Nombre, contacto, horario y cuentas de `store_settings`. Solo lo que existe: nada inventado. */
export async function loadStoreData(): Promise<StoreEmailData> {
  const { data } = await createAdminClient()
    .from("store_settings")
    .select("nombre_negocio, email_contacto, telefono, telefono_secundario, direccion, horario_atencion, cuentas_bancarias")
    .maybeSingle();
  const nombre = data?.nombre_negocio || "Mi casa Store";
  const telefonos = [data?.telefono, data?.telefono_secundario]
    .filter((p): p is string => Boolean(p) && isNormalizedEcPhone(p as string))
    .map(formatEcPhone);
  const cuentas = (Array.isArray(data?.cuentas_bancarias) ? data.cuentas_bancarias : []) as BankAccountInfo[];
  return {
    nombre,
    cuentas,
    ownerTo: getEmailConfig().ownerTo ?? data?.email_contacto ?? null,
    context: {
      siteUrl: getSiteUrl(),
      store: { nombre, email: data?.email_contacto || null, telefonos, direccion: data?.direccion || null, horario: data?.horario_atencion || null },
    },
  };
}

export interface OrderEmailData {
  referencia: string;
  nombre: string;
  email: string;
  total: number;
  venceEn: string;
}

export async function loadOrder(by: { id: string } | { referencia: string }): Promise<OrderEmailData | null> {
  const query = createAdminClient().from("orders").select("referencia, contacto_nombre, contacto_email, total, vence_en");
  const { data } = await ("id" in by ? query.eq("id", by.id) : query.eq("referencia", by.referencia)).maybeSingle();
  if (!data) return null;
  return {
    referencia: data.referencia,
    nombre: data.contacto_nombre,
    email: data.contacto_email,
    total: Number(data.total),
    venceEn: data.vence_en,
  };
}

/** Envía un trabajo con la configuración real. Nunca lanza (ver `processEmail`). */
export async function runEmailJob(job: EmailJob, storeName: string): Promise<Outcome> {
  return processEmail(job, buildDeps(storeName));
}
