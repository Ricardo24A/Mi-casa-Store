import assert from "node:assert/strict";
import { test } from "node:test";
import { formatEcPhone, formatEcPhoneInput, isNormalizedEcPhone, normalizeEcPhone, telHref, whatsappHref } from "./phone-ec.ts";

const digits = (s: string) => {
  const r = normalizeEcPhone(s);
  assert.equal(r.ok, true, `${s} debería ser válido`);
  return r.ok ? r.digits : "";
};
const error = (s: string) => {
  const r = normalizeEcPhone(s);
  assert.equal(r.ok, false, `${s} debería rechazarse`);
  return r.ok ? "" : r.error;
};

test("todas las variantes de un celular llegan al mismo número nacional", () => {
  for (const v of ["0991234567", "099 123 4567", "099-123-4567", "+593 99 123 4567", "593991234567", "+593991234567", "+593 0991234567", "(099) 123-4567", " 0991234567 "]) {
    assert.equal(digits(v), "0991234567", v);
  }
  assert.equal(normalizeEcPhone("0991234567").ok && (normalizeEcPhone("0991234567") as { kind: string }).kind, "celular");
});

test("todas las variantes de un fijo", () => {
  for (const v of ["042345678", "(04) 234-5678", "04 234 5678", "+593 4 234 5678", "59342345678", "(04)2345678", "04-234-5678"]) {
    assert.equal(digits(v), "042345678", v);
  }
  assert.equal((normalizeEcPhone("022638159") as { kind: string }).kind, "fijo");
  for (const p of ["02", "03", "04", "05", "06", "07"]) assert.equal(digits(`${p}2638159`), `${p}2638159`);
});

test("se rechazan letras, largos incorrectos y prefijos inexistentes con mensajes específicos", () => {
  assert.match(error("099abc4567"), /solo números/);
  assert.match(error("099 123 456"), /celular de Ecuador tiene 10 dígitos y empieza con 09/);
  assert.match(error("09912345678"), /celular de Ecuador tiene 10 dígitos y empieza con 09/);
  assert.match(error("0801234567"), /celular de Ecuador tiene 10 dígitos y empieza con 09/);
  assert.match(error("0901234567"), /celular de Ecuador tiene 10 dígitos y empieza con 09/, "el tercer dígito no puede ser 0");
  assert.match(error("082345678"), /02 a 07/);
  assert.match(error("012345678"), /02 a 07/);
  assert.match(error("04234567"), /fijo tiene 9 dígitos con el código de provincia/);
  assert.match(error("0423456789"), /celular de Ecuador/);
  assert.match(error("12345"), /celular.*fijo/);
  assert.match(error(""), /Escribe/);
  assert.match(error("+1 305 555 0101"), /Ecuador/);
  assert.match(error("099+1234567"), /al inicio/);
  assert.match(error("0991234567 0984126739"), /celular de Ecuador/, "dos números en un campo");
});

test("se rechazan dígitos repetidos y secuencias obvias", () => {
  assert.match(error("0999999999"), /no parece real/);
  assert.match(error("0900000000"), /celular de Ecuador/);
  assert.match(error("0911111111"), /no parece real/);
  assert.match(error("0912345678"), /no parece real/);
  assert.match(error("0987654321"), /no parece real/);
  assert.match(error("0923456789"), /no parece real/);
  assert.match(error("042222222"), /no parece real/);
  assert.match(error("022222222"), /no parece real/);
  assert.equal(digits("(04) 234-5678"), "042345678", "una secuencia de 7 dígitos en un fijo es un número posible");
});

test("isNormalizedEcPhone solo acepta lo ya normalizado", () => {
  assert.equal(isNormalizedEcPhone("0991234567"), true);
  assert.equal(isNormalizedEcPhone("099 123 4567"), false);
  assert.equal(isNormalizedEcPhone("+593991234567"), false);
});

test("formato visual, tel: y wa.me", () => {
  assert.equal(formatEcPhone("0991234567"), "099 123 4567");
  assert.equal(formatEcPhone("042345678"), "(04) 234 5678");
  assert.equal(telHref("0991234567"), "tel:+593991234567");
  assert.equal(telHref("042345678"), "tel:+59342345678");
  assert.equal(whatsappHref("0991234567"), "https://wa.me/593991234567");
  assert.equal(whatsappHref("042345678"), null);
});

test("formato mientras se escribe, sin separadores colgantes y se puede borrar", () => {
  assert.equal(formatEcPhoneInput("0"), "0");
  assert.equal(formatEcPhoneInput("099"), "099");
  assert.equal(formatEcPhoneInput("0991"), "099 1");
  assert.equal(formatEcPhoneInput("0991234567"), "099 123 4567");
  assert.equal(formatEcPhoneInput("09912345678999"), "099 123 4567", "no pasa de 10 dígitos");
  assert.equal(formatEcPhoneInput("04"), "(04)");
  assert.equal(formatEcPhoneInput("042"), "(04) 2");
  assert.equal(formatEcPhoneInput("042345678"), "(04) 234 5678");
  assert.equal(formatEcPhoneInput("+593 99 123 4567"), "+593 99 123 4567", "las variantes con +593 se dejan y se normalizan al guardar");
  // Borrar: quitar solo el separador borra también el dígito anterior
  assert.equal(formatEcPhoneInput("(04", "(04)"), "0");
  assert.equal(formatEcPhoneInput("099 123", "099 123 "), "099 12");
  assert.equal(formatEcPhoneInput("(04) 2", "(04) 23"), "(04) 2");
});
