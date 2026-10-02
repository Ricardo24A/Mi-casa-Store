import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ACCOUNT_LOGIN,
  accountRedirect,
  adminRedirect,
  type AccountArea,
  type AdminAccessState,
  type AdminArea,
} from "@/lib/admin-access";
import { safeNext } from "@/lib/safe-next";
import type { UserRole } from "@/types/database";

/** Usuario autenticado (validado contra Supabase Auth) o null. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Rol del usuario actual leído de `profiles` (RLS: cada quien lee solo el suyo). */
export const getRole = cache(async (): Promise<UserRole | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.role as UserRole | undefined) ?? null;
});

export interface AdminSession extends AdminAccessState {
  fullName: string | null;
}

/**
 * Estado de acceso del visitante al dashboard: sesión validada contra Supabase Auth, rol de
 * `profiles`, nivel de la sesión (`aal` del JWT) y si tiene un factor TOTP verificado.
 * Un admin en aal1 puede leer su propia fila de `profiles` (RLS: `id = auth.uid()`), que es
 * lo que permite decidir entre enrolar y verificar.
 */
async function loadAdminSession(): Promise<AdminSession> {
  const empty: AdminSession = { userId: null, role: null, aal: null, hasVerifiedFactor: false, fullName: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [{ data: claims }, { data: profile }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle(),
  ]);

  const aal = claims?.claims.aal;
  return {
    userId: user.id,
    role: (profile?.role as UserRole | undefined) ?? null,
    aal: aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null,
    hasVerifiedFactor: (user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified"),
    fullName: profile?.full_name ?? null,
  };
}

/** Estado de la sesión, deduplicado por petición (lo usan páginas y acciones). */
export const getAdminSession = cache(loadAdminSession);

/**
 * La misma lectura SIN la deduplicación de `cache()`. Para componentes de LAYOUT que van en su propio
 * <Suspense> (menú del panel, saludo de Mi cuenta, dueño del carrito): si compartieran la promesa con
 * la página, la espera de la página quedaría atribuida al layout y Cache Components marcaría la ruta
 * como bloqueante. Cuesta una consulta más a Supabase Auth por componente.
 */
export const getAdminSessionUncached = loadAdminSession;

/** Redirige si la zona no corresponde al estado de la sesión. Devuelve el estado si sí. */
export async function guardAdminArea(area: AdminArea): Promise<AdminSession> {
  const session = await getAdminSession();
  const target = adminRedirect(area, session);
  if (target) redirect(target);
  return session;
}

/**
 * Exige un admin con el 2FA cumplido (aal2). Llamar al inicio de CADA página, route handler y
 * server action del dashboard: un layout no se vuelve a ejecutar en cada navegación, así que su
 * llamada es solo una comodidad. El proxy es la primera barrera y RLS (`is_admin()` exige aal2)
 * la última.
 */
export async function requireAdmin() {
  const session = await guardAdminArea("panel");
  return { userId: session.userId as string, fullName: session.fullName };
}

/**
 * Redirige si la zona de /cuenta no corresponde al estado de la sesión. Si hay que ir al login,
 * conserva `next` (solo rutas que pasan `safeNext`) para volver a donde estaba tras entrar.
 */
export async function guardAccountArea(area: AccountArea, next?: string): Promise<AdminSession> {
  const session = await getAdminSession();
  const target = accountRedirect(area, session);
  if (target) {
    const safe = next ? safeNext(next, "") : "";
    redirect(target === ACCOUNT_LOGIN && safe ? `${ACCOUNT_LOGIN}?next=${encodeURIComponent(safe)}` : target);
  }
  return session;
}

/**
 * Exige un cliente con sesión. Llamar al inicio de CADA página y acción de /cuenta y del checkout.
 * Un administrador no usa la cuenta de cliente: se le envía al dashboard (donde se le pide el 2FA).
 * `next`: ruta a la que volver después de iniciar sesión (p. ej. "/checkout").
 */
export async function requireCustomer(next?: string) {
  const session = await guardAccountArea("panel", next);
  return { userId: session.userId as string, fullName: session.fullName };
}

/** Factores TOTP verificados del usuario actual (para elegir con cuál verificar el código). */
export async function getVerifiedFactors() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (user?.factors ?? [])
    .filter((f) => f.factor_type === "totp" && f.status === "verified")
    .map((f) => ({ id: f.id, name: f.friendly_name ?? "Dispositivo" }));
}
