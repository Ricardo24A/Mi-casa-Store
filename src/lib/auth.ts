import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

/**
 * Exige un admin. Llamar al inicio de TODA página, layout, route handler o server action del
 * dashboard: no basta con el proxy. Devuelve el usuario admin.
 */
export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if ((await getRole()) !== "admin") redirect("/");
  return user;
}
