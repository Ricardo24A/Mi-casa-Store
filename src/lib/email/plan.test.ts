import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as P from "./plan.ts";
import { processEmails, type EmailDeps, type OutgoingEmail } from "./send-core.ts";

const store: P.PlanStore = {
  ownerTo: "dueno@micasa.ec",
  cuentas: [{ banco: "Banco Uno", tipo: "ahorros", numero: "1234567890", titular: "Ana Prueba", identificacion: "1712345678" }],
  context: { siteUrl: "https://micasa.ec", store: { nombre: "Mi casa Store", email: "hola@micasa.ec", telefonos: [], direccion: null, horario: null } },
};
const order: P.PlanOrder = { referencia: "MC-ABCD2345", nombre: "Ana", email: "ana@correo.com", total: 38.5 };

function fakeDeps() {
  const sent: OutgoingEmail[] = [];
  const logs: string[] = [];
  const finished: { estado: string; error: string | null }[] = [];
  const claimed = new Set<string>();
  const deps: EmailDeps = {
    from: "Mi casa Store <pedidos@micasa.ec>",
    testTo: null,
    transport: async (email) => (sent.push(email), { ok: true }),
    claim: async (tipo, referencia, to) => {
      const key = `${tipo}|${referencia}|${to}`;
      if (claimed.has(key)) return { duplicate: true, id: null };
      claimed.add(key);
      return { duplicate: false, id: key };
    },
    finish: async (_id, estado, error) => void finished.push({ estado, error }),
    sleep: async () => {},
    log: (m) => void logs.push(m),
  };
  return { deps, sent, logs, finished };
}

const created: P.OrderCreatedPlanInput = {
  referencia: "MC-ABCD2345",
  to: "ana@correo.com",
  nombre: "Ana",
  venceEn: "2026-10-05T15:00:00Z",
  items: [{ nombre: "Cojín", cantidad: 2, precioUnitario: 18.5 }],
  subtotal: 37,
  descuento: 0,
  descuentoTransferencia: 0,
  envio: 0,
  envioPorCoordinar: true,
  total: 37,
  direccion: { destinatario: "Ana", direccion: "Calle 1", ciudad: "Quito", provincia: "Pichincha" },
};

test("al terminar el checkout se intenta pedido_creado: un correo a la cuenta, con cuentas y plazo", async () => {
  const { deps, sent, finished } = fakeDeps();
  const outcomes = await processEmails(P.planOrderCreated(store, created), deps);
  assert.deepEqual(outcomes, ["enviado"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "ana@correo.com");
  assert.match(sent[0].subject, /MC-ABCD2345/);
  assert.match(sent[0].text, /1234567890/);
  assert.match(sent[0].text, /Tienes hasta el/);
  assert.deepEqual(finished.map((f) => f.estado), ["enviado"]);
});

test("pedido_creado no depende de releer el pedido: sale aunque la base no devuelva nada más", () => {
  const jobs = P.planOrderCreated(store, created);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].tipo, "pedido_creado");
  assert.equal(jobs[0].to, "ana@correo.com");
  assert.equal(jobs[0].referencia, "MC-ABCD2345");
});

test("crearPedido programa el correo DESPUÉS de crear el pedido y antes de devolver, sin redirect ni salidas entre medias", () => {
  const source = readFileSync("src/app/(tienda)/checkout/actions.ts", "utf8");
  const create = source.indexOf('admin.rpc("create_order"');
  const notify = source.indexOf("notifyOrderCreated({");
  const ok = source.indexOf("return { ok: true, referencia");
  assert.ok(create > 0 && notify > create && ok > notify, "create_order → notifyOrderCreated → return");
  const between = source.slice(notify, ok);
  assert.doesNotMatch(between, /redirect\(|throw |return /, "nada que corte el flujo entre programar el correo y terminar");
  assert.match(source.slice(create, notify), /if \(error\) return/, "solo se llega aquí si el pedido se creó");
  assert.match(source, /to: user\.email/, "el destinatario sale de la cuenta, no de una relectura");
});

test("cada acción programa su correo solo tras guardar el cambio", () => {
  const cases: [string, string, string][] = [
    ["src/app/(tienda)/confirmacion/actions.ts", 'admin.rpc("submit_payment_proof"', "notifyProofUploaded("],
    ["src/app/(admin)/admin/(panel)/pedidos/actions.ts", 'rpc("admin_approve_order"', "notifyPaymentApproved("],
    ["src/app/(admin)/admin/(panel)/pedidos/actions.ts", 'rpc("admin_reject_proof"', "notifyProofRejected("],
    ["src/app/(admin)/admin/(panel)/pedidos/actions.ts", 'rpc("admin_cancel_order"', "notifyOrderCancelled("],
    ["src/app/(admin)/admin/(panel)/pedidos/actions.ts", 'rpc("admin_mark_shipped"', "notifyOrderShipped("],
    ["src/app/(tienda)/contacto/actions.ts", 'rpc("create_contact_message"', "notifyOwnerContactMessage("],
  ];
  for (const [file, save, notify] of cases) {
    const source = readFileSync(file, "utf8");
    const a = source.indexOf(save);
    const b = source.indexOf(notify, a);
    assert.ok(a > 0 && b > a, `${file}: ${notify} va después de ${save}`);
    assert.doesNotMatch(source.slice(a, b), /redirect\(/, `${file}: sin redirect antes del correo`);
  }
});

test("comprobante nuevo: el cliente y el dueño reciben su correo, en ese orden y con la misma referencia", async () => {
  const { deps, sent } = fakeDeps();
  const jobs = P.planProofUploaded(store, order, "proof-1");
  assert.deepEqual(jobs.map((j) => j.tipo), ["comprobante_recibido", "dueno_comprobante"]);
  assert.ok(jobs.every((j) => j.referencia === "proof-1"));
  assert.deepEqual(await processEmails(jobs, deps), ["enviado", "enviado"]);
  assert.deepEqual(sent.map((e) => e.to), ["ana@correo.com", "dueno@micasa.ec"]);
});

test("aviso al dueño sin destinatario: el del cliente sale y el del dueño deja rastro con el motivo", async () => {
  const { deps, sent, logs, finished } = fakeDeps();
  const outcomes = await processEmails(P.planProofUploaded({ ...store, ownerTo: null }, order, "proof-1"), deps);
  assert.deepEqual(outcomes, ["enviado", "omitido"]);
  assert.deepEqual(sent.map((e) => e.to), ["ana@correo.com"]);
  assert.deepEqual(finished, [{ estado: "enviado", error: null }, { estado: "omitido", error: P.OWNER_OMIT_REASON }]);
  assert.match(logs.join("\n"), /\[email:omitido\] tipo=dueno_comprobante motivo=sin destinatario del dueño: define EMAIL_OWNER_TO/);
});

test("mensaje de contacto sin destinatario del dueño: omitido con rastro (fila y consola), no silencio", async () => {
  const { deps, sent, logs, finished } = fakeDeps();
  const outcomes = await processEmails(P.planOwnerContactMessage({ ...store, ownerTo: null }, "msg-1", { nombre: "Ana", asunto: null, mensaje: "Hola, quisiera saber algo." }), deps);
  assert.deepEqual(outcomes, ["omitido"]);
  assert.equal(sent.length, 0);
  assert.deepEqual(finished, [{ estado: "omitido", error: P.OWNER_OMIT_REASON }]);
  assert.match(logs[0], /\[email:omitido\] tipo=dueno_mensaje/);
});

test("el mismo evento no se repite: otro intento del mismo comprobante es un duplicado", async () => {
  const { deps, sent } = fakeDeps();
  await processEmails(P.planProofUploaded(store, order, "proof-1"), deps);
  const again = await processEmails(P.planProofUploaded(store, order, "proof-1"), deps);
  assert.deepEqual(again, ["duplicado", "duplicado"]);
  assert.equal(sent.length, 2);
  const next = await processEmails(P.planProofUploaded(store, order, "proof-2"), deps);
  assert.deepEqual(next, ["enviado", "enviado"], "un comprobante nuevo sí es otro evento");
});

test("cada evento produce su tipo y referencia", () => {
  assert.equal(P.planPaymentApproved(store, order)[0].tipo, "pago_aprobado");
  assert.equal(P.planOrderShipped(store, order)[0].tipo, "pedido_enviado");
  assert.equal(P.planOrderCancelled(store, order, null)[0].tipo, "pedido_cancelado");
  const rejected = P.planProofRejected(store, order, "proof-9", "No coincide")[0];
  assert.equal(rejected.tipo, "comprobante_rechazado");
  assert.equal(rejected.referencia, "proof-9", "cada rechazo es un evento distinto");
});
