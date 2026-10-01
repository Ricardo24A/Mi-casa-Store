import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/account/profile-forms";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis datos" };

export default async function ProfilePage() {
  const { userId } = await requireCustomer();
  const supabase = await createClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <h2 className="mb-4 text-xl font-semibold text-ink">Mis datos</h2>
      <ProfileForm
        email={auth.user?.email ?? ""}
        fullName={profile?.full_name ?? ""}
        phone={profile?.phone ?? ""}
      />
      <h2 className="mb-2 mt-10 text-xl font-semibold text-ink">Contraseña</h2>
      <Link href="/nueva-clave" className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
        Cambiar mi contraseña
      </Link>
    </>
  );
}
