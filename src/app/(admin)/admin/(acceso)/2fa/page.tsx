import type { Metadata } from "next";
import { Suspense } from "react";
import { EnrollForm } from "@/components/admin/enroll-form";
import { guardAdminArea } from "@/lib/auth";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

async function EnrollContent() {
  const session = await guardAdminArea("enrolar");
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">
        {session.hasVerifiedFactor ? "Registrar otro dispositivo" : "Protege tu cuenta"}
      </h1>
      <div className="mt-4">
        <EnrollForm hadFactor={session.hasVerifiedFactor} />
      </div>
    </>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<div className="h-72" aria-busy="true" />}>
      <EnrollContent />
    </Suspense>
  );
}
