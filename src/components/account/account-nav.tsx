"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesionCliente } from "@/app/(tienda)/cuenta/actions";
import { clearCartOnSignOut } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/cuenta", label: "Mis pedidos", exact: true },
  { href: "/cuenta/datos", label: "Mis datos" },
  { href: "/cuenta/direcciones", label: "Direcciones" },
];

/**
 * Pestañas de Mi cuenta. En celular, si no caben, se desplazan en horizontal sin barra visible.
 * `overflow-x-auto` obliga al navegador a poner también `overflow-y: auto`, y cualquier píxel de más
 * (el borde de la pestaña activa, un anillo de foco) mostraba una mini barra vertical: por eso
 * `overflow-y-hidden`, y un relleno de 4 px alrededor (el anillo de foco mide 2 px + 2 px de
 * separación) para que el foco no se recorte. La pestaña activa se lleva a la vista al cambiar de página.
 */
export function AccountNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Mi cuenta"
      // Con el teclado, la pestaña (o "Salir") que recibe el foco se desplaza a la vista.
      onFocus={(event) => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className="-mx-4 overflow-x-auto overflow-y-hidden px-4 py-1 [scrollbar-width:none] sm:-mx-1 sm:px-1 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max min-w-full items-center gap-1 border-b border-line">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors duration-150",
                  active ? "border-accent text-accent" : "border-transparent text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="ml-auto">
          <form action={cerrarSesionCliente} onSubmit={clearCartOnSignOut}>
            <button
              type="submit"
              className="-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-4 text-sm font-semibold text-ink-soft transition-colors duration-150 hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
              Salir
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
