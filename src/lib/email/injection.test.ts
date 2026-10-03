// Pruebas de ATAQUE a las plantillas de correo: todo texto que escribe una persona (nombre, dirección,
// producto, motivo, asunto y mensaje de contacto) llega con HTML, comillas, ${}, {{ }}, saltos de línea y
// CRLF. Debe salir escapado en el HTML, sin etiquetas vivas, y el ASUNTO no puede admitir cabeceras.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as T from "./templates.ts";

const store = { nombre: "Mi casa Store", email: "hola@micasa.ec", telefonos: ["099 123 4567"], direccion: "Av. Principal 123", horario: "L-V 9:00 a 18:00" };
const ctx: T.TemplateContext = { store, siteUrl: "https://micasa.ec" };

const PAYLOADS = [
  `<script>alert(1)</script>`,
  `<img src=x onerror=alert(1)>`,
  `"><svg/onload=alert(1)>`,
  `' OR 1=1 --`,
  "${process.env.SECRET}",
  "{{7*7}} {% raw %}",
  "línea1\r\nBcc: atacante@example.com\r\nSubject: otro",
  "javascript:alert(1)",
  "</td></tr></table><h1>inyectado</h1>",
];

const account = { banco: "Banco", tipo: "ahorros", numero: "123", titular: "Ana", identificacion: "1712345678" };

function build(p: string) {
  const ref = { referencia: "MC-ABCD2345", nombre: p };
  return [
    T.orderCreated(ctx, {
      ...ref,
      items: [{ nombre: p, cantidad: 1, precioUnitario: 10 }],
      subtotal: 10, descuento: 0, descuentoTransferencia: 0, envio: 0, envioPorCoordinar: false, total: 10,
      venceEn: "2026-10-05T12:00:00Z", cuentas: [{ ...account, titular: p }],
      direccion: { destinatario: p, direccion: p, ciudad: p, provincia: p },
    }),
    T.proofReceived(ctx, ref),
    T.paymentApproved(ctx, { ...ref, total: 10 }),
    T.proofRejected(ctx, { ...ref, motivo: p }),
    T.orderShipped(ctx, ref),
    T.orderCancelled(ctx, { ...ref, motivo: p }),
    T.orderRejected(ctx, { ...ref, motivo: p }),
    T.ownerContactMessage(ctx, { nombre: p, asunto: p, mensaje: p }),
  ];
}

test("el ASUNTO de ningún correo admite saltos de línea ni caracteres de control (inyección de cabeceras)", () => {
  for (const p of PAYLOADS) for (const e of build(p)) assert.doesNotMatch(e.subject, /[\u0000-\u001f\u007f]/, `${e.subject.slice(0, 60)} con ${JSON.stringify(p).slice(0, 30)}`);
});

test("el HTML nunca trae etiquetas vivas de lo que escribió la persona", () => {
  for (const p of PAYLOADS) {
    for (const e of build(p)) {
      assert.doesNotMatch(e.html, /<script/i, "script vivo");
      assert.doesNotMatch(e.html, /<img[^>]*onerror/i, "img con onerror vivo");
      assert.doesNotMatch(e.html, /<svg/i, "svg vivo");
      assert.doesNotMatch(e.html, /<h1>inyectado/i, "cierre de tabla e HTML inyectado");
      assert.doesNotMatch(e.html, /href="javascript:/i, "enlace javascript:");
    }
  }
});

test("los marcadores de plantilla (${…}, {{…}}) no se evalúan: salen tal cual como texto", () => {
  for (const e of build("${process.env.SECRET}")) assert.doesNotMatch(e.html + e.text, /undefined|secret=/i);
  const e = T.ownerContactMessage(ctx, { nombre: "{{7*7}}", asunto: "{{7*7}}", mensaje: "{{7*7}} ${1+1}" });
  assert.match(e.html, /\{\{7\*7\}\}/);
  assert.doesNotMatch(e.html, /\b49\b/);
});

test("los enlaces de los correos usan solo el sitio configurado y la referencia codificada", () => {
  for (const p of ["../../admin", "MC-1/../../x", "a b?c=d#e"]) {
    const e = T.proofReceived(ctx, { referencia: p, nombre: "x" });
    for (const m of e.html.matchAll(/href="([^"]+)"/g)) {
      assert.match(m[1], /^(https:\/\/micasa\.ec|mailto:|tel:)/, m[1]);
    }
    assert.doesNotMatch(e.html, /confirmacion\/\.\.\//);
  }
});
