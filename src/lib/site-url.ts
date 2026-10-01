/**
 * URL pública del sitio (enlaces de los correos de Supabase, sitemap, robots, metadatos).
 * En producción es obligatoria: sin ella, los enlaces de confirmar correo y recuperar contraseña
 * apuntarían a localhost. `next.config.ts` la comprueba al compilar y al arrancar, así que un
 * despliegue sin ella falla con un mensaje claro en vez de caer en silencio a localhost.
 * Sin imports con alias: la usan next.config.ts y las pruebas.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEV_DEFAULT = "http://localhost:3000";

export function resolveSiteUrl(raw: string | undefined, nodeEnv: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    if (nodeEnv === "production") {
      throw new Error(
        "Falta NEXT_PUBLIC_SITE_URL. En producción debe ser el dominio de la tienda, por ejemplo https://micasastore.ec " +
          "(en Vercel: Settings → Environment Variables, también para Preview). Sin ella los enlaces de los correos apuntarían a localhost.",
      );
    }
    return DEV_DEFAULT;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL no es una URL válida: "${value}". Ejemplo: https://micasastore.ec`);
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error(`NEXT_PUBLIC_SITE_URL debe empezar con https:// (solo localhost puede usar http): "${value}"`);
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(`NEXT_PUBLIC_SITE_URL debe ser solo el dominio, sin rutas ni parámetros: "${value}"`);
  }
  return url.origin;
}

/** URL del sitio sin barra final. Lanza en producción si falta o es inválida. */
export function getSiteUrl(): string {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);
}
