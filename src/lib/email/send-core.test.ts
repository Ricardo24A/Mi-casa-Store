import assert from "node:assert/strict";
import { test } from "node:test";
import { RETRY_DELAY_MS, maskEmail, processEmail, safely, type EmailDeps, type EmailJob, type OutgoingEmail, type TransportResult } from "./send-core.ts";

const rendered = { subject: "Pedido MC-ABCD2345", html: "<p>hola</p>", text: "hola" };

function setup(over: Partial<EmailDeps> & { results?: TransportResult[] } = {}) {
  const sent: OutgoingEmail[] = [];
  const logs: string[] = [];
  const finished: { id: string; estado: string; error: string | null }[] = [];
  const claimed = new Set<string>();
  const results = [...(over.results ?? [])];
  const deps: EmailDeps = {
    from: "Mi casa Store <pedidos@micasa.ec>",
    testTo: null,
    transport: async (email) => {
      sent.push(email);
      return results.shift() ?? { ok: true };
    },
    // Reclamo atómico: el primero gana, como la restricción única de email_log.
    claim: async (tipo, referencia, to) => {
      const key = `${tipo}|${referencia}|${to.toLowerCase()}`;
      if (claimed.has(key)) return { duplicate: true, id: null };
      claimed.add(key);
      return { duplicate: false, id: `id-${claimed.size}` };
    },
    finish: async (id, estado, error) => void finished.push({ id, estado, error }),
    sleep: async () => {},
    log: (m) => void logs.push(m),
    ...over,
  };
  return { deps, sent, logs, finished };
}

const job = (over: Partial<EmailJob> = {}): EmailJob => ({
  tipo: "pedido_creado",
  referencia: "MC-ABCD2345",
  to: "ana@correo.com",
  build: () => rendered,
  ...over,
});

test("envía una vez y registra el resultado", async () => {
  const { deps, sent, finished } = setup();
  assert.equal(await processEmail(job(), deps), "enviado");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "ana@correo.com");
  assert.equal(sent[0].from, "Mi casa Store <pedidos@micasa.ec>");
  assert.equal(sent[0].idempotencyKey, "pedido_creado:MC-ABCD2345:ana@correo.com");
  assert.deepEqual(finished, [{ id: "id-1", estado: "enviado", error: null }]);
});

test("idempotencia: el mismo evento no se envía dos veces (ni con otras mayúsculas ni en paralelo)", async () => {
  const { deps, sent } = setup();
  const results = await Promise.all([
    processEmail(job(), deps),
    processEmail(job(), deps),
    processEmail(job({ to: "ANA@correo.com" }), deps),
  ]);
  assert.deepEqual(results.sort(), ["duplicado", "duplicado", "enviado"]);
  assert.equal(sent.length, 1);
  assert.equal(await processEmail(job(), deps), "duplicado");
  assert.equal(sent.length, 1);
});

test("eventos distintos sí se envían: otro tipo, otro comprobante u otro destinatario", async () => {
  const { deps, sent } = setup();
  assert.equal(await processEmail(job(), deps), "enviado");
  assert.equal(await processEmail(job({ tipo: "pago_aprobado" }), deps), "enviado");
  assert.equal(await processEmail(job({ tipo: "comprobante_rechazado", referencia: "proof-1" }), deps), "enviado");
  assert.equal(await processEmail(job({ tipo: "comprobante_rechazado", referencia: "proof-2" }), deps), "enviado", "un segundo rechazo es otro evento");
  assert.equal(await processEmail(job({ to: "otra@correo.com" }), deps), "enviado");
  assert.equal(sent.length, 5);
});

test("si el envío falla, el flujo principal termina bien: nunca lanza y registra fallido", async () => {
  const boom = setup({ transport: async () => { throw new Error("secreto: re_clave_123"); } });
  assert.equal(await processEmail(job(), boom.deps), "fallido");
  assert.equal(boom.finished[0].estado, "fallido");
  assert.doesNotMatch(boom.logs.join("\n") + boom.finished[0].error, /re_clave_123/, "el mensaje del error no se filtra");
});

test("si todo lo demás falla (claim, finish, build, log), tampoco lanza", async () => {
  const claimDown = setup({ claim: async () => { throw new Error("db caída"); } });
  assert.equal(await processEmail(job(), claimDown.deps), "enviado", "sin registro, el aviso sale igual");
  assert.equal(claimDown.sent.length, 1);

  const finishDown = setup({ finish: async () => { throw new Error("db caída"); } });
  assert.equal(await processEmail(job(), finishDown.deps), "enviado");

  const buildDown = setup();
  assert.equal(await processEmail(job({ build: () => { throw new Error("sin datos"); } }), buildDown.deps), "fallido");
  assert.equal(buildDown.sent.length, 0);

  const logDown = setup({ log: () => { throw new Error("consola rota"); } });
  await assert.doesNotReject(processEmail(job(), logDown.deps));
});

test("safely: un error inesperado de cualquier trabajo no llega a quien lo programó", async () => {
  const logs: string[] = [];
  await assert.doesNotReject(safely(async () => { throw new Error("x"); }, (m) => logs.push(m), "pedido_creado"));
  assert.match(logs[0], /pedido_creado/);
});

test("un 429 o un 5xx se reintenta UNA vez; si vuelve a fallar queda fallido, sin bucles", async () => {
  const recovers = setup({ results: [{ ok: false, status: 429, error: "rate_limit" }, { ok: true }] });
  assert.equal(await processEmail(job(), recovers.deps), "enviado");
  assert.equal(recovers.sent.length, 2);

  const twice = setup({ results: [{ ok: false, status: 429, error: "rate_limit" }, { ok: false, status: 429, error: "rate_limit" }, { ok: true }] });
  assert.equal(await processEmail(job(), twice.deps), "fallido");
  assert.equal(twice.sent.length, 2, "como máximo un reintento");
  assert.match(twice.finished[0].error ?? "", /429/);

  const server = setup({ results: [{ ok: false, status: 503, error: "x" }, { ok: true }] });
  assert.equal(await processEmail(job(), server.deps), "enviado");
});

test("un error del cliente (4xx distinto de 429) no se reintenta", async () => {
  const { deps, sent, finished } = setup({ results: [{ ok: false, status: 422, error: "invalid_from" }] });
  assert.equal(await processEmail(job(), deps), "fallido");
  assert.equal(sent.length, 1);
  assert.match(finished[0].error ?? "", /422/);
  assert.ok(RETRY_DELAY_MS <= 3000, "el reintento es corto");
});

test("sin clave de Resend: simulación; registra tipo y destinatario enmascarado, no el contenido", async () => {
  const { deps, logs, finished } = setup({ transport: null });
  assert.equal(await processEmail(job({ build: () => ({ ...rendered, text: "CONTENIDO-SECRETO" }) }), deps), "simulado");
  assert.deepEqual(finished.map((f) => f.estado), ["simulado"]);
  assert.match(logs[0], /\[email:simulado\] tipo=pedido_creado destinatario=a\*\*\*@c\*\*\*\.com/);
  assert.doesNotMatch(logs.join("\n"), /CONTENIDO-SECRETO|ana@correo\.com/);
});

test("EMAIL_TEST_TO: todo va a esa dirección, con el original en el asunto y la clave de idempotencia del original", async () => {
  const { deps, sent } = setup({ testTo: "dueno@gmail.com" });
  await processEmail(job(), deps);
  assert.equal(sent[0].to, "dueno@gmail.com");
  assert.match(sent[0].subject, /^\[Prueba para a\*\*\*@c\*\*\*\.com\] /);
  assert.match(sent[0].idempotencyKey, /ana@correo\.com/);
});

test("sin destinatario válido no se envía ni se reclama", async () => {
  const { deps, sent } = setup();
  for (const to of [null, "", "no-es-correo", "a@b"]) assert.equal(await processEmail(job({ to }), deps), "omitido");
  assert.equal(sent.length, 0);
});

test("maskEmail no deja la dirección completa", () => {
  assert.equal(maskEmail("Ana.Perez@Gmail.com"), "a***@g***.com");
  assert.doesNotMatch(maskEmail("ana@correo.com"), /ana|correo/);
});
