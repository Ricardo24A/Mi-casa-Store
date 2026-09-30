import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Pantalla completa de acceso (login, registro, recuperar), sin el header ni el footer de la
 * tienda. Dos columnas: a la izquierda el logo sobre el fondo crema de la marca; a la derecha
 * el formulario. En celular es una sola columna con el logo arriba.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="flex flex-col items-center justify-center gap-4 bg-bg px-6 py-8 lg:py-12">
        <Link href="/" aria-label="Mi casa Store: ir al inicio" className="rounded-full">
          <Image
            src="/brand/logo-original.png"
            alt="Mi casa Store"
            width={480}
            height={480}
            priority
            sizes="(min-width: 1024px) 480px, 128px"
            className="size-32 rounded-full lg:size-auto lg:max-h-[min(60vh,30rem)] lg:w-auto"
          />
        </Link>
        <p className="hidden text-2xl font-semibold tracking-tight text-accent lg:block">Todo para tu hogar</p>
      </aside>

      <main className="flex items-start justify-center bg-surface px-6 py-10 lg:items-center lg:py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
