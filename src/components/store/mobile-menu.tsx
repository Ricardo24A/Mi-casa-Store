"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { CategoryNode } from "@/types/store";

/** Menú lateral para celular: categorías visibles con sus subcategorías. */
export function MobileMenu({ categories }: { categories: CategoryNode[] }) {
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

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-bg-alt md:hidden"
        aria-label="Abrir menú"
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-ink/40" onClick={close} aria-hidden />
          <nav className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-semibold text-accent">Mi casa Store</span>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-bg-alt"
                aria-label="Cerrar menú"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <ul className="flex-1 py-2">
              <li>
                <Link href="/catalogo" onClick={close} className="flex min-h-11 items-center px-4 text-sm font-semibold text-ink hover:bg-soft">
                  Todos los productos
                </Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id} className="border-t border-line/60">
                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink hover:bg-soft [&::-webkit-details-marker]:hidden">
                      {cat.nombre}
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="pb-2">
                      <li>
                        <Link href={`/categoria/${cat.slug}`} onClick={close} className="flex min-h-11 items-center px-8 text-sm text-accent hover:bg-soft">
                          Ver todo en {cat.nombre}
                        </Link>
                      </li>
                      {cat.subcategorias.map((sub) => (
                        <li key={sub.id}>
                          <Link href={`/categoria/${sub.slug}`} onClick={close} className="flex min-h-11 items-center px-8 text-sm text-ink-soft hover:bg-soft hover:text-ink">
                            {sub.nombre}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
