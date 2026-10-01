import type { NextConfig } from "next";
import { buildCsp, cspHeaderName } from "./src/lib/csp";
import { resolveSiteUrl } from "./src/lib/site-url";

// En producción falta NEXT_PUBLIC_SITE_URL (o es inválida) = la compilación y el arranque fallan aquí
// con un mensaje claro, en vez de usar localhost en los enlaces de los correos.
resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);

/**
 * INTERRUPTOR DE LA CSP (ver README, "Cabeceras de seguridad"):
 *   false = Content-Security-Policy-Report-Only: no bloquea nada; las infracciones salen en la consola
 *           del navegador. Así se publica primero, para revisar que nada legítimo quede fuera.
 *   true  = Content-Security-Policy: el navegador bloquea lo que la política no permite.
 */
const CSP_ENFORCE = false;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : undefined;
// Host del proyecto Supabase (para permitir imágenes públicas de productos).
const supabaseHost = supabaseUrl?.hostname;

const securityHeaders = [
  {
    key: cspHeaderName(CSP_ENFORCE),
    value: buildCsp({ supabaseOrigin: supabaseUrl?.origin, dev: process.env.NODE_ENV !== "production", enforce: CSP_ENFORCE }),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Sin `preload`: inscribir el dominio en la lista de precarga de los navegadores es casi irreversible y
  // se decide cuando el dominio definitivo esté confirmado.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Aísla la ventana de la tienda de las que abra o la abran (los enlaces externos ya usan noopener).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Habilita 'use cache' (catálogo público en caché, invalidado por etiqueta).
  cacheComponents: true,
  poweredByHeader: false,
  experimental: {
    // Subida de comprobantes por una acción de servidor: 4 MB de archivo más el multipart. Queda por
    // debajo de los 4,5 MB que aceptan las funciones de Vercel. Es un límite global de las acciones.
    serverActions: { bodySizeLimit: "4.4mb" },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // Login único: las direcciones anteriores redirigen a él (el resto de la consulta, como `next`,
  // se conserva). El dashboard sigue protegido por el proxy y por requireAdmin().
  async redirects() {
    return [
      { source: "/admin/login", destination: "/login", permanent: false },
      { source: "/cuenta/login", destination: "/login", permanent: false },
      { source: "/cuenta/registro", destination: "/registro", permanent: false },
      { source: "/cuenta/recuperar", destination: "/recuperar", permanent: false },
      { source: "/cuenta/nueva-clave", destination: "/nueva-clave", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
