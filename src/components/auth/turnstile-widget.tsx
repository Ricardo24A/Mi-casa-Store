"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: { sitekey: string; theme?: string; language?: string }) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile. Dentro de un <form>, el widget agrega solo el campo oculto
 * `cf-turnstile-response`, que las acciones de servidor verifican con `verifyTurnstile()`.
 * `resetKey` cambia tras cada envío: el token sirve una sola vez, así que se pide uno nuevo.
 * Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no dibuja nada (desarrollo); en producción el servidor
 * rechaza los envíos sin token válido.
 */
export function TurnstileWidget({ resetKey }: { resetKey?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  function render() {
    if (!SITE_KEY || !containerRef.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "light",
      language: "es",
    });
  }

  // Si el script ya estaba cargado (navegación entre páginas), se dibuja al montar.
  useEffect(() => {
    render();
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  );
}
