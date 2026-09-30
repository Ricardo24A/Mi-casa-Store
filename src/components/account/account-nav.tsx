"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cerrarSesionCliente } from "@/app/(tienda)/cuenta/actions";
import { clearCartOnSignOut } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/cuenta", label: "Mis pedidos", exact: true },
  { href: "/cuenta/datos", label: "Mis datos" },
  { href: "/cuenta/direcciones", label: "Direcciones" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mi cuenta" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex items-center gap-1 border-b border-line">
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
