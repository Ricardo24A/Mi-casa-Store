import assert from "node:assert/strict";
import { test } from "node:test";
import { esc, oneLine } from "./render.ts";
import * as T from "./templates.ts";

const store = {
  nombre: "Mi casa Store",
  email: "hola@micasa.ec",
  telefonos: ["099 123 4567"],
  direccion: "Av. Principal 123",
  horario: "Lunes a viernes, 9:00 a 18:00",
};
const ctx: T.TemplateContext = { store, siteUrl: "https://micasa.ec" };

const EVIL = `<script>alert("x")</script> O'Brien & "Hijos" <img src=x onerror=alert(1)>`;
const account = { banco: "Banco Uno", tipo: "ahorros", numero: "1234567890", titular: `Ana <b>Prueba</b>`, identificacion: "1712345678" };

const created: T.OrderCreatedData = {
  referencia: "MC-ABCD2345",
  nombre: EVIL,
  items: [
    { nombre: EVIL, cantidad: 2, precioUnitario: 10 },
    { nombre: "Cojín", cantidad: 1, precioUnitario: 18.5 },
  ],
  subtotal: 38.5,
  descuento: 0,
  descuentoTransferencia: 0,
  envio: 0,
  envioPorCoordinar: true,
  total: 38.5,
  venceEn: "2026-10-05T15:00:00Z",
  cuentas: [account],
  direccion: { destinatario: EVIL, direccion: EVIL, ciudad: "Quito", provincia: "Pichincha" },
};

/** Ninguna etiqueta ni atributo del usuario sale sin escapar. */
function assertSafe(html: string) {
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /<b>/i);
  // Lo que escribió el usuario queda como texto inerte: toda mención de "onerror" va dentro de una etiqueta escapada.
  assert.equal(html.split("onerror").length, html.split("&lt;img src=x onerror").length);
  assert.doesNotMatch(html, /alert\("x"\)/);
}

test("esc escapa los cinco caracteres de HTML y oneLine quita saltos y controles", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(oneLine("Hola\r\nBcc: x@y.com\u0000 fin"), "Hola Bcc: x@y.com fin");
});

test("todos los correos traen asunto, HTML, texto plano y un pie con los datos reales", () => {
  const all = [
    T.orderCreated(ctx, created),
    T.proofReceived(ctx, { referencia: "MC-ABCD2345", nombre: "Ana" }),
    T.paymentApproved(ctx, { referencia: "MC-ABCD2345", nombre: "Ana", total: 38.5 }),
    T.proofRejected(ctx, { referencia: "MC-ABCD2345", nombre: "Ana", motivo: "No coincide" }),
    T.orderShipped(ctx, { referencia: "MC-ABCD2345", nombre: "Ana" }),
    T.orderCancelled(ctx, { referencia: "MC-ABCD2345", nombre: "Ana", motivo: null }),
    T.ownerProofToReview(ctx, { referencia: "MC-ABCD2345", total: 38.5 }),
    T.ownerContactMessage(ctx, { nombre: "Ana", asunto: null, mensaje: "Hola, quisiera saber si hacen envíos." }),
  ];
  for (const e of all) {
    assert.ok(e.subject.length > 5, e.subject);
    assert.ok(e.text.length > 40, "texto plano presente");
    assert.match(e.html, /<!DOCTYPE html>/);
    assert.match(e.html, /max-width:600px/, "ancho máximo de 600 px");
    assert.match(e.html, /#F0DFC6/);
    assert.match(e.html, /#3E5C4B/);
    for (const part of [e.html, e.text]) {
      assert.match(part, /Mi casa Store/);
      assert.match(part, /hola@micasa\.ec/);
      assert.match(part, /099 123 4567/);
      assert.match(part, /Av\. Principal 123/);
      assert.match(part, /Lunes a viernes, 9:00 a 18:00/);
    }
    assert.doesNotMatch(e.html, /<img|https?:\/\/[^"' ]*\.(png|jpg|gif)/i, "sin imágenes remotas ni tracking");
    assert.doesNotMatch(e.html + e.text, /Compra con confianza|garantía|envío gratis/i, "sin frases de marketing");
  }
});

test("el pie solo muestra los datos que existen", () => {
  const bare: T.TemplateContext = { siteUrl: "https://micasa.ec", store: { nombre: "Mi casa Store", email: null, telefonos: [], direccion: null, horario: null } };
  const e = T.proofReceived(bare, { referencia: "MC-ABCD2345", nombre: "Ana" });
  for (const part of [e.html, e.text]) {
    assert.doesNotMatch(part, /Teléfono|Correo:|Horario|Av\./);
  }
});

test("pedido creado: escapa todo lo que escribe el usuario (script, comillas, apóstrofes)", () => {
  const e = T.orderCreated(ctx, created);
  assertSafe(e.html);
  assert.match(e.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; O&#39;Brien &amp; &quot;Hijos&quot;/);
  assert.match(e.html, /Ana &lt;b&gt;Prueba&lt;\/b&gt;/, "también el titular de la cuenta");
  assert.doesNotMatch(e.subject, /[\r\n]/);
});

test('pedido creado: "A coordinar" cuando el envío no está definido, y el monto cuando sí', () => {
  const sin = T.orderCreated(ctx, created);
  assert.match(sin.html, /A coordinar/);
  assert.match(sin.text, /Envío: A coordinar/);
  assert.doesNotMatch(sin.text, /Envío: \$/);

  const con = T.orderCreated(ctx, { ...created, envioPorCoordinar: false, envio: 3.5, total: 42 });
  assert.doesNotMatch(con.html, /A coordinar/);
  assert.match(con.text, /Envío: \$3,50/);
  assert.match(con.text, /Total a transferir: \$42,00/);
});

test("pedido creado: el descuento por transferencia aparece solo si aplica", () => {
  const sin = T.orderCreated(ctx, created);
  assert.doesNotMatch(sin.html + sin.text, /Descuento por transferencia|Descuentos/);

  const con = T.orderCreated(ctx, { ...created, descuento: 2, descuentoTransferencia: 1.5, total: 35 });
  for (const part of [con.html, con.text]) {
    assert.match(part, /Descuento por transferencia/);
    assert.match(part, /Descuentos/);
  }
  assert.match(con.text, /Descuento por transferencia: -\$1,50/);
});

test("pedido creado: cuentas completas, plazo, concepto, cómo subir el comprobante y el enlace a /confirmacion", () => {
  const e = T.orderCreated(ctx, { ...created, cuentas: [account, { ...account, banco: "Banco Dos", numero: "99887766" }] });
  for (const part of [e.html, e.text]) {
    assert.match(part, /Banco Uno/);
    assert.match(part, /1234567890/);
    assert.match(part, /1712345678/);
    assert.match(part, /Banco Dos/);
    assert.match(part, /99887766/);
    assert.match(part, /MC-ABCD2345 como concepto/);
    assert.match(part, /subir el comprobante/);
    assert.match(part, /Tienes hasta el .*2026/);
    assert.match(part, /https:\/\/micasa\.ec\/confirmacion\/MC-ABCD2345/);
  }
  assert.match(e.subject, /MC-ABCD2345/);
});

test("comprobante rechazado: el motivo del administrador va escapado y en el texto plano", () => {
  const e = T.proofRejected(ctx, { referencia: "MC-ABCD2345", nombre: EVIL, motivo: `Monto distinto: <script>alert("x")</script> "no coincide"` });
  assertSafe(e.html);
  assert.match(e.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &quot;no coincide&quot;/);
  assert.match(e.text, /Motivo\nMonto distinto: <script>alert\("x"\)<\/script> "no coincide"/, "el texto plano no es HTML: no se escapa");
  assert.match(e.html, /confirmacion\/MC-ABCD2345/);
  assert.match(e.subject, /MC-ABCD2345/);
});

test("comprobante rechazado: los saltos de línea del motivo se respetan sin abrir HTML", () => {
  const e = T.proofRejected(ctx, { referencia: "MC-ABCD2345", nombre: "Ana", motivo: "Línea uno\nLínea <dos>" });
  assert.match(e.html, /Línea uno<br>Línea &lt;dos&gt;/);
});

test("recibido, aprobado, enviado y cancelado no prometen tiempos ni inventan datos", () => {
  const all = [
    T.proofReceived(ctx, { referencia: "MC-ABCD2345", nombre: "Ana" }),
    T.paymentApproved(ctx, { referencia: "MC-ABCD2345", nombre: "Ana", total: 38.5 }),
    T.orderShipped(ctx, { referencia: "MC-ABCD2345", nombre: "Ana" }),
    T.orderCancelled(ctx, { referencia: "MC-ABCD2345", nombre: "Ana", motivo: "Sin stock" }),
  ];
  for (const e of all) {
    assert.doesNotMatch(e.text, /\b(horas|días|minutos|24|48|pronto|inmediat|garant)/i, e.subject);
    assert.match(e.text, /MC-ABCD2345/);
  }
  assert.match(all[3].text, /Motivo\nSin stock/);
  assert.match(all[1].text, /\$38,50/);
});

test("correos al dueño: enlaces a rutas del panel y datos escapados", () => {
  const proof = T.ownerProofToReview(ctx, { referencia: "MC-ABCD2345", total: 38.5 });
  assert.match(proof.html, /https:\/\/micasa\.ec\/admin\/pedidos\/MC-ABCD2345/);
  assert.match(proof.text, /https:\/\/micasa\.ec\/admin\/pedidos\/MC-ABCD2345/);
  assert.match(proof.subject, /MC-ABCD2345/);

  const msg = T.ownerContactMessage(ctx, { nombre: EVIL, asunto: EVIL, mensaje: `${EVIL}\n${"a".repeat(400)}` });
  assertSafe(msg.html);
  assert.match(msg.html, /https:\/\/micasa\.ec\/admin\/mensajes/);
  assert.doesNotMatch(msg.subject, /[\r\n]/);
});

test("mensaje de contacto: solo una vista previa corta, nunca el mensaje completo", () => {
  const largo = "Hola ".repeat(200);
  const e = T.ownerContactMessage(ctx, { nombre: "Ana", asunto: null, mensaje: largo });
  assert.match(e.text, /Sin asunto/);
  assert.match(e.text, /…/);
  assert.ok(!e.text.includes(largo.trim()), "el mensaje completo no viaja por correo");
  const preview = /Vista previa\n([^\n]+)/.exec(e.text)?.[1] ?? "";
  assert.ok(Array.from(preview).length <= T.CONTACT_PREVIEW_CHARS + 1, `vista previa de ${preview.length} caracteres`);
});

test("el asunto nunca puede inyectar cabeceras", () => {
  const e = T.ownerContactMessage(ctx, { nombre: "Ana\r\nBcc: robo@x.com", asunto: null, mensaje: "Hola, quisiera saber algo." });
  assert.doesNotMatch(e.subject, /[\r\n]/);
});
