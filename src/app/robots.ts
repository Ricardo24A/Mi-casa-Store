import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/login", "/registro", "/recuperar", "/nueva-clave", "/carrito", "/checkout", "/confirmacion"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
