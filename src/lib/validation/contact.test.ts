import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTACT_FIELDS, charCount, contactFormSchema } from "./contact.ts";

const base = {
  nombre: "Ana Prueba",
  email: "ana@correo.com",
  telefono: "098 412 6739",
  asunto: "",
  mensaje: "Hola, ¿tienen envío a Cuenca?",
  acepta: "on",
};
const parse = (over: Record<string, unknown> = {}) => contactFormSchema.safeParse({ ...base, ...over });
/** Mensaje del primer error de un campo. */
const errorOf = (field: string, over: Record<string, unknown>) => {
  const r = parse(over);
  assert.equal(r.success, false, JSON.stringify(over));
  return r.success ? "" : (r.error.issues.find((i) => i.path[0] === field)?.message ?? "");
};

test("datos válidos: teléfono normalizado, asunto vacío = null, texto sin espacios sobrantes", () => {
  const r = parse({ nombre: "  Ana Prueba ", mensaje: "  Hola, ¿tienen envío a Cuenca?\r\nGracias  " });
  assert.equal(r.success, true);
  assert.deepEqual(r.success && r.data, {
    nombre: "Ana Prueba",
    email: "ana@correo.com",
    telefono: "0984126739",
    asunto: null,
    mensaje: "Hola, ¿tienen envío a Cuenca?\nGracias",
    acepta: "on",
  });
});

test("obligatorios: nombre, correo, teléfono, mensaje y la aceptación", () => {
  assert.match(errorOf("nombre", { nombre: "" }), /nombre/);
  assert.match(errorOf("email", { email: " " }), /correo/);
  assert.match(errorOf("telefono", { telefono: "" }), /teléfono/);
  assert.match(errorOf("mensaje", { mensaje: "" }), /mensaje/);
  assert.match(errorOf("acepta", { acepta: undefined }), /acepta/);
  assert.match(errorOf("acepta", { acepta: "off" }), /acepta/);
});

test("teléfono: misma regla de Ecuador que Configuración, con mensajes claros", () => {
  const plus = parse({ telefono: "+593 98 412 6739" });
  assert.equal(plus.success && plus.data.telefono, "0984126739");
  const fijo = parse({ telefono: "(04) 234 5678" });
  assert.equal(fijo.success && fijo.data.telefono, "042345678");
  assert.match(errorOf("telefono", { telefono: "0812345678" }), /09/);
  assert.match(errorOf("telefono", { telefono: "0999999999" }), /no parece real/);
  assert.match(errorOf("telefono", { telefono: "+57 300 123 4567" }), /Ecuador/);
  assert.match(errorOf("telefono", { telefono: "abc" }), /solo números/);
});

test("correo: formato válido y aceptado también por la base de datos", () => {
  assert.equal(parse({ email: "o'neil+tienda@mi-correo.ec" }).success, true);
  assert.match(errorOf("email", { email: "ana@correo" }), /correo válido/);
  assert.match(errorOf("email", { email: "ana@@correo.com" }), /correo válido/);
  assert.match(errorOf("email", { email: `${"a".repeat(65)}@correo.com` }), /correo válido/);
});

test("mensaje: de 10 a 1000 caracteres, contados como caracteres y no como unidades UTF-16", () => {
  assert.match(errorOf("mensaje", { mensaje: "Hola" }), /al menos 10/);
  assert.equal(parse({ mensaje: "a".repeat(1000) }).success, true);
  assert.match(errorOf("mensaje", { mensaje: "a".repeat(1001) }), /máximo 1000.*1001/);
  // 5 emojis son 10 unidades UTF-16 pero 5 caracteres: no llegan al mínimo (como char_length en Postgres)
  assert.equal(charCount("😀😀😀😀😀"), 5);
  assert.match(errorOf("mensaje", { mensaje: "😀😀😀😀😀" }), /al menos 10/);
  assert.equal(parse({ mensaje: "😀".repeat(1000) }).success, true);
});

test("sin HTML: se rechazan etiquetas, pero no el texto con < común", () => {
  assert.match(errorOf("mensaje", { mensaje: "Hola <script>alert(1)</script>" }), /HTML/);
  assert.match(errorOf("mensaje", { mensaje: "Mira esto <a href=x>aquí</a> por favor" }), /HTML/);
  assert.match(errorOf("nombre", { nombre: "<b>Ana</b>" }), /HTML/);
  assert.match(errorOf("asunto", { asunto: "<!-- hola -->" }), /HTML/);
  assert.equal(parse({ mensaje: "El precio es < 10 dólares <3" }).success, true);
});

test("caracteres de control: el mensaje admite saltos de línea y tabuladores, el resto no", () => {
  assert.equal(parse({ mensaje: "Línea uno\n\tLínea dos" }).success, true);
  assert.match(errorOf("mensaje", { mensaje: "Hola\u0000 qué tal amigos" }), /no permitidos/);
  assert.match(errorOf("nombre", { nombre: "Ana\nPrueba" }), /no permitidos/);
});

test("asunto opcional, hasta 120 caracteres; nombre de 2 a 120", () => {
  const r = parse({ asunto: "  Envíos  " });
  assert.equal(r.success && r.data.asunto, "Envíos");
  assert.match(errorOf("asunto", { asunto: "a".repeat(121) }), /120/);
  assert.match(errorOf("nombre", { nombre: "A" }), /al menos 2/);
  assert.match(errorOf("nombre", { nombre: "a".repeat(121) }), /120/);
});

test("el orden de los campos para el foco coincide con el esquema", () => {
  assert.deepEqual([...CONTACT_FIELDS].sort(), Object.keys(contactFormSchema.shape).sort());
});
