import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

// Rutas del dashboard que no exigen sesión (el login vive aquí; se crea en la Fase 3).
const ADMIN_PUBLIC_PATHS = ["/admin/login"];

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * 1) Refresca la sesión de Supabase (las cookies se renuevan aquí) cuando hay cookie `sb-*`
 *    o la ruta es del dashboard; las visitas públicas sin sesión no llaman a Supabase.
 * 2) Protege /admin/*: exige sesión y rol admin. Es la primera barrera; las páginas y acciones
 *    del dashboard vuelven a comprobarlo en servidor con `requireAdmin()` (src/lib/auth.ts),
 *    y RLS es la barrera final en la base de datos.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminRoute = isAdminPath(pathname);

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch {
    // Sin configuración de Supabase: la tienda sigue sirviendo páginas estáticas,
    // pero el dashboard queda cerrado.
    return adminRoute
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next({ request });
  }

  // Visita pública sin sesión: no hay nada que refrescar, se evita la llamada a Supabase Auth.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  if (!adminRoute && !hasSessionCookie) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token con Supabase Auth (getSession() solo lee la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!adminRoute || ADMIN_PUBLIC_PATHS.includes(pathname)) {
    return response;
  }

  // Redirige conservando las cookies de sesión recién refrescadas.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) return redirectTo("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return redirectTo("/");

  return response;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes optimizadas.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
