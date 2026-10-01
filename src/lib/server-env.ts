import "server-only";

/**
 * Secretos que solo existen en el servidor. `server-only` hace fallar la compilación si un componente
 * de cliente importa este módulo, directa o indirectamente. Ninguna de estas variables lleva el prefijo
 * NEXT_PUBLIC_, así que tampoco se incrustan en el JavaScript del navegador.
 */

/** Clave service_role de Supabase: se salta RLS. */
export function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY. Revisa .env.local (ver .env.example).");
  }
  return key;
}

/**
 * Clave de las huellas HMAC (límites de intentos, IP del formulario de contacto, aviso de recuperación
 * de contraseña). `RATE_LIMIT_SECRET` si existe; si no, la clave service_role, que también es secreta y
 * solo vive aquí. Cambiarla solo reinicia los contadores y anula los avisos de recuperación en curso.
 */
export function getHmacSecret() {
  return process.env.RATE_LIMIT_SECRET || getServiceRoleKey();
}
