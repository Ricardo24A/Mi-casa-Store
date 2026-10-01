import "server-only";
import { hmacHex } from "@/lib/hmac";
import {
  RATE_RULES,
  firstBlocking,
  interpretRateLimit,
  type FailMode,
  type RateDecision,
  type RateRuleName,
} from "@/lib/rate-limit-core";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RateCheck {
  rule: RateRuleName;
  /** IP, correo normalizado o id de usuario; null = este control no aplica (p. ej. sin IP en local). */
  identity: string | null;
}

/**
 * Cuenta un intento en cada contador, en orden, y se detiene en el primero que no permita seguir.
 * La clave que llega a la base es la huella HMAC de la identidad, nunca el dato en claro.
 * `mode` decide qué pasa si la función de límite falla (ver `FailMode`).
 */
export async function checkRateLimits(checks: RateCheck[], mode: FailMode): Promise<RateDecision> {
  const decisions: RateDecision[] = [];
  for (const check of checks) {
    if (!check.identity) continue;
    const rule = RATE_RULES[check.rule];
    let decision: RateDecision;
    try {
      const response = await createAdminClient().rpc("rate_limit_hit", {
        p_bucket: rule.bucket,
        p_clave: hmacHex(`rl:${rule.bucket}`, check.identity),
        p_max: rule.max,
        p_ventana: `${rule.windowSeconds} seconds`,
      });
      decision = interpretRateLimit(response, mode);
    } catch (thrown) {
      decision = interpretRateLimit({ thrown }, mode);
    }
    decisions.push(decision);
    if (decision !== "allow") break;
  }
  return firstBlocking(decisions);
}
