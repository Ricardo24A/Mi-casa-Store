/**
 * Content-Security-Policy de la tienda, sin nonce. La usa `next.config.ts` (sin imports con alias,
 * para poder probarla).
 *
 * Por qué sin nonce: el proyecto usa `cacheComponents` (prerenderizado parcial). Según la guía de
 * Next (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md), una CSP con nonce
 * obliga a renderizar todo en cada visita y es incompatible con el prerenderizado parcial. Por eso
 * los scripts en línea de Next se permiten con 'unsafe-inline'. Aun así la política bloquea scripts
 * y marcos de otros sitios, `<object>`, cambiar `<base>`, enviar formularios a otros dominios,
 * conexiones a otros servidores y que la tienda se muestre dentro de otra página.
 *
 * Qué permite y por qué:
 *  - challenges.cloudflare.com: script y marco de Turnstile.
 *  - img-src del proyecto Supabase: el panel muestra imágenes del bucket y el comprobante firmado
 *    directo desde Supabase (la tienda usa /_next/image, que es 'self'); `data:` para el QR del 2FA y
 *    `blob:` para las vistas previas antes de subir.
 *  - connect-src 'self': el navegador nunca llama a Supabase (todo pasa por el servidor).
 *  - En desarrollo: 'unsafe-eval' (React lo usa para depurar) y websockets de la recarga en caliente.
 */
export function buildCsp({ supabaseOrigin, dev, enforce }: { supabaseOrigin?: string; dev: boolean; enforce: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Solo tiene efecto en modo de bloqueo (en Report-Only el navegador lo ignora) y no en localhost.
  if (enforce && !dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** Nombre de la cabecera según el interruptor: solo avisar (Report-Only) o aplicar y bloquear. */
export function cspHeaderName(enforce: boolean): string {
  return enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}
