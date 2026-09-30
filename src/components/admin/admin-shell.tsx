"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BadgePercent, ClipboardList, FolderTree, LayoutDashboard, LogOut, Menu, Package, X, type LucideIcon } from "lucide-react";
import { cerrarSesion } from "@/app/(admin)/admin/actions";
import { clearCartOnSignOut } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo activo con la ruta exacta (Resumen no debe quedar activo en las demás). */
  exact?: boolean;
  /** Contador que se muestra junto al nombre (p. ej. pedidos por revisar). */
  badge?: "pedidos";
}

/**
 * Solo hay enlaces a pantallas que existen. Cada sección (Configuración) se agrega aquí junto con
 * su página.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/descuentos", label: "Descuentos", icon: BadgePercent },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: "pedidos" },
];

function SidebarContent({
  fullName,
  pendingOrders,
  onNavigate,
  closeRef,
  onClose,
}: {
  fullName: string | null;
  pendingOrders: number;
  onNavigate?: () => void;
  closeRef?: React.Ref<HTMLButtonElement>;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-lg font-semibold">Mi casa Store</p>
          <p className="text-sm text-accent-mid">Panel del dueño</p>
        </div>
        {onClose && (
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-accent"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label="Panel" className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-150",
                    active ? "bg-accent text-bg" : "text-accent-mid hover:bg-accent/60 hover:text-bg",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
                  {item.label}
                  {item.badge === "pedidos" && pendingOrders > 0 && (
                    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-bg px-2 text-xs font-semibold leading-6 text-accent-hover">
                      <span aria-hidden>{pendingOrders > 99 ? "99+" : pendingOrders}</span>
                      <span className="sr-only">{pendingOrders} por revisar</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-accent px-3 py-3">
        <p className="truncate px-3 pb-2 text-sm text-accent-mid">{fullName ?? "Administrador"}</p>
        <form action={cerrarSesion} onSubmit={clearCartOnSignOut}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-accent-mid transition-colors duration-150 hover:bg-accent/60 hover:text-bg"
          >
            <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
            Salir
          </button>
        </form>
      </div>
    </>
  );
}

/** Marco del panel: menú lateral fijo en escritorio y cajón en móvil. */
export function AdminShell({
  fullName,
  pendingOrders = 0,
  children,
}: {
  fullName: string | null;
  pendingOrders?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="on-dark fixed inset-y-0 left-0 hidden w-64 flex-col bg-accent-hover text-bg lg:flex">
        <SidebarContent fullName={fullName} pendingOrders={pendingOrders} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-bg-alt"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="text-lg font-semibold text-accent">Mi casa Store</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="on-dark absolute inset-y-0 left-0 flex w-[85%] max-w-72 flex-col bg-accent-hover text-bg">
            <SidebarContent
              fullName={fullName}
              pendingOrders={pendingOrders}
              closeRef={closeRef}
              onClose={() => setOpen(false)}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
