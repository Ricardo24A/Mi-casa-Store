import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { ACCEPTANCE_VERSION_PATTERN, LEGAL_DOCS, LEGAL_LINKS, LEGAL_VERSIONS, acceptanceVersion } from "./index.ts";
import { PLAZO_NO_DISPONIBLE, plazoTexto, runsText } from "./runs.ts";
import type { LegalDoc } from "./types.ts";
import * as T from "../../lib/email/templates.ts";
import { ACCEPT_TERMS_ERROR, acceptTermsBoolean, acceptTermsField } from "../../lib/validation/terms.ts";

const read = (path: string) => readFileSync(path, "utf8");

/** Todo el texto visible de un documento, con el plazo indicado. */
function fullText(doc: LegalDoc, horas: number | null): string {
  return doc.bloques
    .map((b) => {
      switch (b.t) {
        case "h2":
          return b.text;
        case "p":
          return runsText(b.runs, horas);
        case "ul":
          return b.items.map((i) => runsText(i, horas)).join("\n");
        case "note":
          return `${b.title}${b.titleInline ? "" : " "}${b.paragraphs.map((p) => runsText(p, horas)).join("\n")}`;
      }
    })
    .join("\n");
}

test("hay una página por documento y cada una usa su texto", () => {
  for (const [slug, title] of [
    ["privacidad", "Políticas de Privacidad"],
    ["terminos", "Términos y Condiciones"],
    ["cookies", "Política de Cookies"],
  ] as const) {
    const file = `src/app/(tienda)/${slug}/page.tsx`;
    assert.ok(existsSync(file), file);
    const source = read(file);
    assert.match(source, /<LegalPage doc=\{/, `${file} usa LegalPage`);
    assert.match(source, /export const metadata/, `${file} tiene metadatos`);
    assert.equal(LEGAL_DOCS[slug].titulo, title);
  }
});

test("el texto del cliente se publica tal cual (frases clave, sin retoques)", () => {
  const privacy = fullText(LEGAL_DOCS.privacidad, null);
  for (const phrase of [
    "valoramos y respetamos su privacidad",
    "Nombre y apellidos.",
    "Imágenes de comprobantes de transferencia bancaria que usted carga directamente a través de nuestra plataforma web para validar su pago.",
    "Procesar, preparar y facturar sus pedidos.",
    "Sus datos personales no serán vendidos ni compartidos con terceros con fines comerciales.",
    "La única excepción aplicable es la información compartida con las empresas de mensajería",
  ]) {
    assert.ok(privacy.includes(phrase), phrase);
  }
  const terms = fullText(LEGAL_DOCS.terminos, 48);
  for (const phrase of [
    "2.1. Proceso de Compra y Pago",
    "Importante - Verificación de Pagos: El envío del comprobante por la web es un requisito obligatorio",
    "El tiempo estimado de entrega es de 1 a 5 días hábiles",
    "Proporcionaremos el número de guía para el rastreo oportuno del paquete.",
    "Solo se aceptarán cambios o devoluciones que correspondan a defectos de fábrica.",
    "dentro de las primeras 24 horas",
    "jurisdicción de Zaruma, provincia de El Oro",
  ]) {
    assert.ok(terms.includes(phrase), phrase);
  }
  const cookies = fullText(LEGAL_DOCS.cookies, null);
  for (const phrase of ["Cookies Estrictamente Necesarias:", "Cookies Funcionales:", "Zaruma, El Oro, Ecuador."]) {
    assert.ok(cookies.includes(phrase), phrase);
  }
});

test("cada documento lleva su fecha y su versión", () => {
  for (const doc of Object.values(LEGAL_DOCS)) {
    assert.equal(doc.actualizado, "2 de octubre de 2026");
    assert.match(doc.version, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.deepEqual(LEGAL_VERSIONS, { privacidad: "2026-10-02", terminos: "2026-10-02", cookies: "2026-10-02" });
});

test("plazo de pago: los Términos muestran las horas REALES, en las dos frases, y nunca un 48 fijo", () => {
  for (const horas of [1, 24, 72, 168]) {
    const text = fullText(LEGAL_DOCS.terminos, horas);
    const word = horas === 1 ? "hora" : "horas";
    assert.ok(text.includes(`plazo máximo de ${horas} ${word} para realizar el pago`), `primera frase con ${horas}`);
    assert.ok(text.includes(`en el plazo de ${horas} ${word}, el sistema cancelará`), `segunda frase con ${horas}`);
    if (horas !== 24) assert.ok(!text.includes("24 horas") || text.includes("primeras 24 horas"));
  }
  assert.ok(!fullText(LEGAL_DOCS.terminos, 72).includes("48 horas"));
  assert.equal(plazoTexto(48), "48 horas");
  assert.equal(plazoTexto(1), "1 hora");
  assert.equal(plazoTexto(null), PLAZO_NO_DISPONIBLE, "sin dato, no se inventa un número");
  assert.doesNotMatch(PLAZO_NO_DISPONIBLE, /\d/);
});

test("el archivo de los Términos no tiene el plazo escrito a mano", () => {
  const source = read("src/content/legal/terminos.ts");
  assert.equal((source.match(/\{ plazo: true(?:, b: true)? \},/g) ?? []).length, 2, "las dos menciones usan el valor real");
  const withoutComments = source.replace(/\/\*\*[\s\S]*?\*\//g, "");
  assert.ok(!/\b48\b/.test(withoutComments), "ningún 48 escrito a mano en el texto");
});

test("la página de Términos lee el plazo de Configuración y se actualiza al guardarla", () => {
  assert.match(read("src/app/(tienda)/terminos/page.tsx"), /getPaymentDeadlineHours\(\)/);
  const data = read("src/lib/legal-data.ts");
  assert.match(data, /horas_limite_pago/);
  assert.match(data, /cacheTag\(STORE_INFO_TAG\)/);
  assert.match(read("src/app/(admin)/admin/(panel)/configuracion/actions.ts"), /updateTag\(STORE_INFO_TAG\)/, "guardar Configuración invalida la etiqueta");
});

test("pie de la tienda: enlaces a Privacidad, Términos y Cookies, todos a páginas que existen", () => {
  assert.deepEqual(LEGAL_LINKS.map((l) => l.href), ["/privacidad", "/terminos", "/cookies"]);
  const footer = read("src/components/store/footer.tsx");
  assert.match(footer, /LEGAL_LINKS\.map/);
  for (const link of LEGAL_LINKS) assert.ok(existsSync(`src/app/(tienda)${link.href}/page.tsx`), `${link.href} existe`);
  const sitemap = read("src/app/sitemap.ts");
  for (const link of LEGAL_LINKS) assert.ok(sitemap.includes(link.href), `${link.href} en el sitemap`);
});

test("correos: el pie trae los tres enlaces legales con la URL del sitio y apuntan a páginas que existen", () => {
  const ctx = { siteUrl: "https://micasa.ec", store: { nombre: "Mi casa Store", email: null, telefonos: [], direccion: null, horario: null } };
  const e = T.proofReceived(ctx, { referencia: "MC-ABCD2345", nombre: "Ana" });
  for (const part of [e.html, e.text]) {
    assert.match(part, /https:\/\/micasa\.ec\/privacidad/);
    assert.match(part, /https:\/\/micasa\.ec\/terminos/);
    assert.match(part, /https:\/\/micasa\.ec\/cookies/);
  }
  for (const l of T.EMAIL_LEGAL_PATHS) assert.ok(existsSync(`src/app/(tienda)${l.path}/page.tsx`), `${l.path} existe`);
  // Sin enlaces rotos: todas las rutas internas de los correos existen como páginas.
  const links = new Set([...e.html.matchAll(/href="https:\/\/micasa\.ec(\/[^"]*)"/g)].map((m) => m[1]));
  for (const path of links) {
    const first = path.split("/")[1];
    assert.ok(existsSync(`src/app/(tienda)/${first}`), `${path} no existe`);
  }
});

test("la casilla de aceptación es obligatoria en el servidor (registro y checkout)", () => {
  assert.equal(acceptTermsField.safeParse("on").success, true);
  for (const bad of [undefined, null, "", "off", "true", true, false, 1]) assert.equal(acceptTermsField.safeParse(bad).success, false, String(bad));
  assert.equal(acceptTermsBoolean.safeParse(true).success, true);
  for (const bad of [undefined, null, "", "on", false, 0]) assert.equal(acceptTermsBoolean.safeParse(bad).success, false, String(bad));
  const err = acceptTermsField.safeParse(undefined);
  assert.equal(err.success ? "" : err.error.issues[0].message, ACCEPT_TERMS_ERROR);

  // Los esquemas del servidor la usan, y las acciones guardan la constancia.
  assert.match(read("src/lib/validation/account.ts"), /acepta: acceptTermsField/);
  assert.match(read("src/lib/validation/checkout.ts"), /acepta: acceptTermsBoolean/);
  assert.match(read("src/app/(acceso)/actions.ts"), /terminos_version: acceptanceVersion\(\)/);
  assert.match(read("src/app/(tienda)/checkout/actions.ts"), /record_order_terms/);
  assert.match(read("src/app/(tienda)/checkout/actions.ts"), /checkoutInputSchema\.safeParse\(input\)/);
});

test("registro, checkout y contacto enlazan a los documentos", () => {
  const accept = read("src/components/legal/accept-terms.tsx");
  assert.match(accept, /href="\/terminos"/);
  assert.match(accept, /href="\/privacidad"/);
  assert.match(accept, /Acepto los/);
  assert.match(read("src/components/auth/auth-forms.tsx"), /<AcceptTerms/);
  assert.match(read("src/components/checkout/checkout-view.tsx"), /<AcceptTerms/);
  assert.match(read("src/components/store/contact-form.tsx"), /href="\/privacidad"/);
});

test("la versión que se guarda cumple lo que exige la base de datos", () => {
  const v = acceptanceVersion();
  assert.match(v, ACCEPTANCE_VERSION_PATTERN);
  assert.ok(v.length <= 80);
  assert.equal(v, "terminos 2026-10-02 + privacidad 2026-10-02");
  assert.match(read("supabase/migrations/20260929000024_terms_acceptance.sql"), /\^\[A-Za-z0-9 \._:\/\+-\]\{1,80\}\$/);
});

test("el pie de cada página legal trae los datos de Configuración y el enlace a /contacto", () => {
  const page = read("src/components/legal/legal-page.tsx");
  assert.match(page, /getPublicStoreInfo\(\)/);
  assert.match(page, /href="\/contacto"/);
  assert.match(page, /print:/, "estilo de impresión");
  assert.ok(existsSync("src/app/(tienda)/contacto/page.tsx"));
});
