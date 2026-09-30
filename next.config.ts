import type { NextConfig } from "next";

// Host del proyecto Supabase (para permitir imágenes públicas de productos).
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// Cabeceras de seguridad base. La CSP estricta (con nonce) se define en la Fase 6.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Habilita 'use cache' (catálogo público en caché, invalidado por etiqueta).
  cacheComponents: true,
  poweredByHeader: false,
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
