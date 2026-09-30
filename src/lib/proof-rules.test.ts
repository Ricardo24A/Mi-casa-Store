import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PROOFS, activeProof, lastRejected, proofAction, type ProofSummary } from "./proof-rules.ts";

const NOW = new Date("2026-10-01T12:00:00Z");
const FUTURE = "2026-10-02T12:00:00Z";
const PAST = "2026-10-01T11:00:00Z";
const proof = (estado: ProofSummary["estado"], minute = 0, motivo: string | null = null): ProofSummary => ({
  estado,
  motivo,
  created_at: `2026-10-01T10:${String(minute).padStart(2, "0")}:00Z`,
});

test("pendiente de pago y vigente: se puede subir", () => {
  assert.deepEqual(proofAction({ orderStatus: "pendiente_pago", dueAt: FUTURE, now: NOW, proofs: [] }), { kind: "subir", remaining: 3 });
});

test("comprobante en revisión y vigente: se puede reemplazar, con los reemplazos que quedan", () => {
  const r = proofAction({ orderStatus: "comprobante_recibido", dueAt: FUTURE, now: NOW, proofs: [proof("en_revision")] });
  assert.deepEqual(r, { kind: "reemplazar", remaining: 2 });
});

test("un comprobante aprobado no se puede cambiar", () => {
  const r = proofAction({ orderStatus: "comprobante_recibido", dueAt: FUTURE, now: NOW, proofs: [proof("aprobado")] });
  assert.deepEqual(r, { kind: "ninguna", reason: "aprobado" });
});

test("un pedido vencido no admite subida ni reemplazo", () => {
  assert.deepEqual(proofAction({ orderStatus: "pendiente_pago", dueAt: PAST, now: NOW, proofs: [] }), { kind: "ninguna", reason: "vencido" });
  assert.deepEqual(
    proofAction({ orderStatus: "comprobante_recibido", dueAt: PAST, now: NOW, proofs: [proof("en_revision")] }),
    { kind: "ninguna", reason: "vencido" },
  );
});

test("máximo 3 comprobantes por pedido, contando el historial", () => {
  const three = [proof("reemplazado", 1), proof("reemplazado", 2), proof("en_revision", 3)];
  assert.equal(three.length, MAX_PROOFS);
  assert.deepEqual(proofAction({ orderStatus: "comprobante_recibido", dueAt: FUTURE, now: NOW, proofs: three }), { kind: "ninguna", reason: "limite" });
  const rejected = [proof("rechazado", 1), proof("rechazado", 2), proof("rechazado", 3)];
  assert.deepEqual(proofAction({ orderStatus: "pendiente_pago", dueAt: FUTURE, now: NOW, proofs: rejected }), { kind: "ninguna", reason: "limite" });
});

test("tras un rechazo el pedido vuelve a pendiente de pago y se puede subir uno nuevo", () => {
  const r = proofAction({ orderStatus: "pendiente_pago", dueAt: FUTURE, now: NOW, proofs: [proof("rechazado", 1, "Monto incorrecto")] });
  assert.deepEqual(r, { kind: "subir", remaining: 2 });
});

test("en cualquier otro estado del pedido no se puede", () => {
  for (const orderStatus of ["pagado", "enviado", "entregado", "cancelado", "vencido", "rechazado"]) {
    assert.deepEqual(proofAction({ orderStatus, dueAt: FUTURE, now: NOW, proofs: [proof("en_revision")] }), { kind: "ninguna", reason: "estado" }, orderStatus);
  }
});

test("el comprobante vigente ignora el historial; el último rechazo trae su motivo", () => {
  const list = [proof("reemplazado", 1), proof("rechazado", 2, "Borroso"), proof("rechazado", 3, "Monto incorrecto"), proof("en_revision", 4)];
  assert.equal(activeProof(list)?.estado, "en_revision");
  assert.equal(lastRejected(list)?.motivo, "Monto incorrecto");
  assert.equal(activeProof([proof("reemplazado")]), null);
});
