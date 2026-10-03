// E18 (tienda). Nombres de categoría, subcategoría y producto con HTML y marcadores hostiles (los crea el dueño; aquí se
// preparan con service_role, prefijo zz-sec-) deben mostrarse como TEXTO en la tienda: ninguna etiqueta viva en el HTML,
// el título ni el sitemap, y la búsqueda no refleja HTML. Sin cuentas: solo servidor local + service_role.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { APP_URL, PREFIX, appUp, assertDevOnly, check, ensureCategory, ensureProduct, getPage, haveService, installSummary, svc } from "./lib.mjs";

installSummary("E18. Renderizado hostil en la tienda");
const up = await appUp();
const skip = (!up || !haveService) && (!up ? `no hay servidor en ${APP_URL}` : "falta service_role");
if (!skip) assertDevOnly();

const CAT = `<img src=x onerror=alert('cat')>`;
const SUB = `"><svg/onload=alert('sub')>`;
const NAME = `<script>alert('prod')</script> & "q" 'a' \${7*7} {{7*7}}`;
const DESC = `<img src=x onerror=alert('desc')> línea 2\r\n<iframe src=//evil.example></iframe>`;
const slugs = { cat: `${PREFIX}xss-cat`, sub: `${PREFIX}xss-sub`, prod: `${PREFIX}xss-prod` };

before(async () => {
  if (skip) return;
  const cat = await ensureCategory(slugs.cat, CAT, null, true);
  const sub = await ensureCategory(slugs.sub, SUB, cat, true);
  const id = await ensureProduct("xss-prod", { nombre: NAME, precio: 5, stock: 3, categoryId: sub });
  await svc("PATCH", `/rest/v1/products?id=eq.${id}`, { descripcion: DESC });
});
after(async () => {
  if (skip) return;
  // Se retira de la tienda (no se borra): el producto de prueba queda inactivo y sus categorías, desactivadas.
  await svc("PATCH", `/rest/v1/products?slug=eq.${slugs.prod}`, { activo: false });
  await svc("PATCH", `/rest/v1/categories?slug=in.(${slugs.cat},${slugs.sub})`, { activa: false });
});

const LIVE = [/<img[^>]*onerror/i, /<svg[^>]*onload/i, /<script>alert\(/i, /<iframe[^>]*evil\.example/i];
const strip = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""); // el JSON interno de Next va en <script> y escapa < como <

describe("E18. la tienda muestra los nombres como texto", { skip }, () => {
  test("ninguna página trae etiquetas vivas de los nombres hostiles", async () => {
    await new Promise((r) => setTimeout(r, 500));
    for (const path of ["/", "/catalogo", `/categoria/${slugs.cat}`, `/categoria/${slugs.sub}`, `/producto/${slugs.prod}`, "/sitemap.xml"]) {
      const r = await getPage(path);
      const raw = r.text;
      const live = LIVE.filter((re) => re.test(strip(raw)) || (path === "/sitemap.xml" && re.test(raw)));
      // Aun dentro del JSON de Next (<script>), un "<" literal podría cerrar la etiqueta: debe ir escapado.
      const scriptJson = [...raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
      const breaks = /<\/?script|<img[^>]*onerror|<iframe/i.test(scriptJson);
      check(assert, "E18", `GET ${path}`, "sin etiquetas vivas, ni en el HTML ni en el JSON interno", `${r.status}${live.length ? " (ETIQUETA VIVA)" : ""}${breaks ? " (JSON sin escapar)" : ""}`, r.status < 500 && live.length === 0 && !breaks);
    }
  });
  test("control positivo: el texto sí aparece, escapado", async () => {
    const r = await getPage(`/producto/${slugs.prod}`);
    const shown = r.text.includes("&lt;script&gt;alert(&#x27;prod&#x27;)&lt;/script&gt;") || r.text.includes("&lt;script&gt;alert(&#39;prod&#39;)&lt;/script&gt;") || r.text.includes("&lt;script&gt;alert('prod')&lt;/script&gt;");
    check(assert, "E18", "la ficha del producto muestra el nombre escapado", "&lt;script&gt;…", shown ? "escapado" : "no aparece (¿producto no visible?)", shown);
    const title = /<title>([^<]*)<\/title>/.exec(r.text)?.[1] ?? "";
    check(assert, "E18", "el <title> no contiene una etiqueta viva", "texto escapado", title.slice(0, 60), !/<script|<img/i.test(title));
  });
  test("la búsqueda no refleja HTML: caja de búsqueda, titulares y metadatos", async () => {
    for (const q of [`"><script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `</title><script>alert(1)</script>`, `'-alert(1)-'`, `\${7*7}`, `{{7*7}}`, `%3Cscript%3Ealert(1)%3C/script%3E`]) {
      const r = await getPage(`/catalogo?q=${encodeURIComponent(q)}`);
      const live = LIVE.some((re) => re.test(strip(r.text))) || /<\/title><script/i.test(r.text);
      const json = [...r.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
      check(assert, "E18", `/catalogo?q=${q.slice(0, 30)}`, "sin etiqueta viva", `${r.status}${live ? " (ETIQUETA VIVA)" : ""}${/<\/?script>alert/i.test(json) ? " (JSON sin escapar)" : ""}`, r.status < 500 && !live && !/<\/?script>alert/i.test(json));
    }
  });
});
