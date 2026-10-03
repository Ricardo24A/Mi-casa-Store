import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminRedirect, areaForPath } from "@/lib/admin-access";
import { getSupabaseEnv } from "@/lib/env";
import { hasMalformedEncoding } from "@/lib/path-guard";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * 1) Refresca la sesión de Supabase (las cookies se renuevan aquí) cuando hay cookie `sb-*`
 *    o la ruta es del dashboard; las visitas públicas sin sesión no llaman a Supabase.
 * 2) Protege /admin/*: exige sesión, rol admin y segundo factor (aal2). La decisión la toma
 *    `adminRedirect()`, la misma que usa `requireAdmin()`. Es la primera barrera; las páginas y acciones
 *    del dashboard vuelven a comprobarlo en servidor con `requireAdmin()` (src/lib/auth.ts),
 *    y RLS es la barrera final en la base de datos.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Un `%` mal formado en la ruta es una petición inválida: 400, no el 500 del enrutador.
  if (hasMalformedEncoding(pathname)) return new NextResponse("Solicitud inválida", { status: 400 });
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
      // Igual que en src/lib/supabase/server.ts: la sesión renovada aquí también lleva `Secure` en producción.
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
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

  if (!adminRoute) return response;

  // Redirige conservando las cookies de sesión recién refrescadas.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  let role: "admin" | "customer" | null = null;
  let aal: "aal1" | "aal2" | null = null;
  if (user) {
    // Un admin en aal1 puede leer su propia fila (RLS: id = auth.uid()).
    const [{ data: profile }, { data: claims }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.auth.getClaims(),
    ]);
    role = profile?.role === "admin" || profile?.role === "customer" ? profile.role : null;
    aal = claims?.claims.aal === "aal2" ? "aal2" : claims?.claims.aal === "aal1" ? "aal1" : null;
  }

  const target = adminRedirect(areaForPath(pathname), {
    userId: user?.id ?? null,
    role,
    aal,
    hasVerifiedFactor: (user?.factors ?? []).some(
      (f) => f.factor_type === "totp" && f.status === "verified",
    ),
  });

  return target ? redirectTo(target) : response;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes optimizadas.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
