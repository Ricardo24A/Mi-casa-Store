// Destino seguro para "volver a donde estaba" tras iniciar sesión o confirmar el correo.
// Solo rutas internas de la cuenta y del proceso de compra: evita redirecciones abiertas
// (`//sitio-malo.com`, `https://...`, `/\\...`) y no lleva a /admin.

const ALLOWED = /^\/(?:cuenta|carrito|checkout)(?:\/[a-z0-9\-/]*)?$/;

export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 200) return fallback;
  return ALLOWED.test(value) ? value : fallback;
}
