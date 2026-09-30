import type { ReactNode } from "react";

/** Marco de las pantallas de acceso (login, enrolar, verificar): una tarjeta centrada. */
export default function AccesoLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-2xl font-semibold tracking-tight text-accent">Mi casa Store</p>
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
