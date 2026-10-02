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

export interface EmailConfig {
  /** RESEND_API_KEY. null = modo simulación (no se envía nada; se registra el tipo y el destinatario enmascarado). */
  apiKey: string | null;
  /** EMAIL_FROM, p. ej. "Mi casa Store <pedidos@dominio>". null = remitente de prueba de Resend. */
  from: string | null;
  /** EMAIL_OWNER_TO. null = el correo de contacto de Configuración. */
  ownerTo: string | null;
  /** EMAIL_TEST_TO. Solo para pruebas: redirige TODOS los correos a esta dirección. Debe estar vacío en producción. */
  testTo: string | null;
}

const clean = (value: string | undefined) => value?.trim() || null;

/** Configuración de correos transaccionales (Resend). Nunca llega al navegador: este módulo es server-only. */
export function getEmailConfig(): EmailConfig {
  return {
    apiKey: clean(process.env.RESEND_API_KEY),
    from: clean(process.env.EMAIL_FROM),
    ownerTo: clean(process.env.EMAIL_OWNER_TO),
    testTo: clean(process.env.EMAIL_TEST_TO),
  };
}
