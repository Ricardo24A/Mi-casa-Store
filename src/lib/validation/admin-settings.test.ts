import assert from "node:assert/strict";
import { test } from "node:test";
import { readBankRows, settingsFieldErrors, settingsFormSchema } from "./admin-settings.ts";

const account = { banco: "Banco Uno", tipo: "ahorros", numero: "1234567890", titular: "Ana Prueba", identificacion: "1712345678" };
const base = {
  nombre_negocio: "Mi casa Store",
  email_contacto: "",
  telefono: "",
  telefono_secundario: "",
  direccion: "",
  horario_atencion: "",
  facebook: "",
  horas_limite_pago: "48",
  descuento_transferencia_pct: "0",
  costo_envio: "",
  envio_gratis_desde: "",
  umbral_stock_bajo: "5",
  cuentas: [account],
};
const parse = (over: Record<string, unknown> = {}) => settingsFormSchema.safeParse({ ...base, ...over });
const errors = (over: Record<string, unknown>) => {
  const r = parse(over);
  assert.equal(r.success, false, JSON.stringify(over));
  return r.success ? {} : settingsFieldErrors(r.error);
};

test("lo mínimo es válido y lo vacío queda sin definir", () => {
  const r = parse();
  assert.equal(r.success, true);
  assert.deepEqual(r.success && r.data, {
    nombre_negocio: "Mi casa Store",
    email_contacto: null,
    telefono: null,
    telefono_secundario: null,
    direccion: null,
    horario_atencion: null,
    cuentas_bancarias: [account],
    costo_envio: null,
    envio_gratis_desde: null,
    descuento_transferencia_pct: 0,
    horas_limite_pago: 48,
    umbral_stock_bajo: 5,
    enlaces_redes: {},
  });
});

test("horario de atención: opcional, una línea de hasta 120 caracteres, solo texto", () => {
  const ok = parse({ horario_atencion: "  Lunes a viernes, 9:00 a 18:00  " });
  assert.equal(ok.success && ok.data.horario_atencion, "Lunes a viernes, 9:00 a 18:00");
  assert.equal(parse({ horario_atencion: "a".repeat(120) }).success, true);
  assert.match(errors({ horario_atencion: "a".repeat(121) }).horario_atencion, /120/);
  assert.match(errors({ horario_atencion: "Lunes<script>" }).horario_atencion, /HTML/);
  assert.match(errors({ horario_atencion: "Lunes" }).horario_atencion, /no permitidos/);
});

test("plazo de pago: de 1 a 168 horas, entero", () => {
  assert.equal(parse({ horas_limite_pago: "1" }).success, true);
  assert.equal(parse({ horas_limite_pago: "168" }).success, true);
  assert.match(errors({ horas_limite_pago: "0" }).horas_limite_pago, /menor que 1/);
  assert.match(errors({ horas_limite_pago: "169" }).horas_limite_pago, /mayor que 168/);
  assert.match(errors({ horas_limite_pago: "24,5" }).horas_limite_pago, /0 decimales/);
  assert.match(errors({ horas_limite_pago: "" }).horas_limite_pago, /plazo/);
  assert.match(errors({ horas_limite_pago: "abc" }).horas_limite_pago, /número válido/);
});

test("descuento por transferencia: de 0 a menos de 100, hasta 2 decimales, coma permitida", () => {
  const ok = parse({ descuento_transferencia_pct: "5,5" });
  assert.equal(ok.success && ok.data.descuento_transferencia_pct, 5.5);
  assert.equal(parse({ descuento_transferencia_pct: "99,99" }).success, true);
  assert.match(errors({ descuento_transferencia_pct: "100" }).descuento_transferencia_pct, /menor que 100/);
  assert.match(errors({ descuento_transferencia_pct: "-1" }).descuento_transferencia_pct, /menor que 0/);
  assert.match(errors({ descuento_transferencia_pct: "1,234" }).descuento_transferencia_pct, /2 decimales/);
  assert.match(errors({ descuento_transferencia_pct: "" }).descuento_transferencia_pct, /0/);
});

test("envío: costo opcional (puede ser 0) y envío gratis desde un monto mayor que 0", () => {
  const free = parse({ costo_envio: "0" });
  assert.equal(free.success && free.data.costo_envio, 0, "0 es 'envío gratis' decidido a propósito, distinto de vacío");
  const paid = parse({ costo_envio: "3,5", envio_gratis_desde: "50" });
  assert.equal(paid.success && paid.data.costo_envio, 3.5);
  assert.equal(paid.success && paid.data.envio_gratis_desde, 50);
  assert.match(errors({ costo_envio: "-2" }).costo_envio, /menor que 0/);
  assert.match(errors({ costo_envio: "2", envio_gratis_desde: "0" }).envio_gratis_desde, /mayor que 0/);
  assert.match(errors({ envio_gratis_desde: "50" }).costo_envio, /define también el costo/);
});

test("umbral de stock bajo: entero de 0 a 1000", () => {
  assert.equal(parse({ umbral_stock_bajo: "0" }).success, true);
  assert.match(errors({ umbral_stock_bajo: "1001" }).umbral_stock_bajo, /mayor que 1000/);
  assert.match(errors({ umbral_stock_bajo: "2,5" }).umbral_stock_bajo, /0 decimales/);
});

test("contacto: correo válido, y Facebook solo con https y de facebook", () => {
  assert.match(errors({ email_contacto: "no-es-correo" }).email_contacto, /Correo/);
  assert.match(errors({ facebook: "http://facebook.com/tienda" }).facebook, /https/);
  assert.match(errors({ facebook: "https://evil.example/facebook.com" }).facebook, /Facebook/);
  assert.match(errors({ facebook: "javascript:alert(1)" }).facebook, /https/);
  const path = (n: number) => `https://facebook.com/${"a".repeat(n - "facebook.com/".length)}`;
  assert.equal(parse({ facebook: path(255) }).success, true, "255 caracteres tras https:// se aceptan");
  assert.match(errors({ facebook: path(256) }).facebook, /https/, "256 se rechazan");
  const ok = parse({ facebook: "https://www.facebook.com/micasastore", email_contacto: "hola@micasa.ec" });
  assert.deepEqual(ok.success && ok.data.enlaces_redes, { facebook: "https://www.facebook.com/micasastore" });
});

test("cuentas bancarias: formato, hasta 10 y sin repetidas", () => {
  assert.equal(parse({ cuentas: [] }).success, true, "sin cuentas es válido (el checkout se bloquea aparte)");
  assert.match(errors({ cuentas: [{ ...account, numero: "12ab" }] })["cuentas.0.numero"], /dígitos/);
  assert.match(errors({ cuentas: [{ ...account, tipo: "vista" }] })["cuentas.0.tipo"], /tipo de cuenta/);
  assert.ok(errors({ cuentas: [{ ...account, banco: "" }] })["cuentas.0.banco"]);
  assert.ok(errors({ cuentas: [{ ...account, identificacion: "1" }] })["cuentas.0.identificacion"]);
  assert.match(errors({ cuentas: [account, { ...account, banco: "BANCO UNO" }] })["cuentas.1.numero"], /repetida/);
  assert.equal(parse({ cuentas: [account, { ...account, numero: "9999999999" }] }).success, true);
  const many = Array.from({ length: 11 }, (_, i) => ({ ...account, numero: String(10000 + i) }));
  assert.ok(errors({ cuentas: many }).cuentas);
});

test("readBankRows agrupa los campos indexados y acota la cantidad", () => {
  const data: Record<string, string> = { "cuentas.count": "2" };
  for (const [k, v] of Object.entries(account)) data[`cuentas.0.${k}`] = v;
  data["cuentas.1.banco"] = "Otro";
  const rows = readBankRows((n) => data[n] ?? "");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].numero, "1234567890");
  assert.equal(rows[1].numero, "");
  assert.equal(readBankRows((n) => (n === "cuentas.count" ? "9999" : "")).length, 15);
  assert.equal(readBankRows(() => "").length, 0);
});

test("teléfonos del negocio: se normalizan y el secundario no se repite ni va solo", () => {
  const ok = parse({ telefono: "+593 99 841 2673", telefono_secundario: "(04) 263-8159" });
  assert.equal(ok.success && ok.data.telefono, "0998412673");
  assert.equal(ok.success && ok.data.telefono_secundario, "042638159");
  assert.match(errors({ telefono: "12345" }).telefono, /celular|fijo/);
  assert.match(errors({ telefono: "0998412673", telefono_secundario: "593 998412673" }).telefono_secundario, /ya está en el otro campo/);
  assert.match(errors({ telefono: "", telefono_secundario: "0998412673" }).telefono_secundario, /principal/);
  assert.equal(parse({ telefono: "  " }).success && (parse({ telefono: "  " }) as { data: { telefono: null } }).data.telefono, null);
});
