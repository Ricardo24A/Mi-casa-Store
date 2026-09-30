"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { confirmarEnrolamiento, empezarEnrolamiento } from "@/app/(admin)/admin/actions";
import { Field, FormError } from "@/components/ui/form-controls";
import { buttonClass } from "@/components/ui/button";

type Step =
  | { name: "inicio" }
  | { name: "escanear"; factorId: string; qr: string; secret: string }
  | { name: "listo" };

/**
 * Enrolamiento de un dispositivo TOTP. En el primer acceso, al terminar invita a registrar un
 * segundo dispositivo (respaldo por si se pierde el primero).
 */
export function EnrollForm({ hadFactor }: { hadFactor: boolean }) {
  // Se fija al montar: tras confirmar, la sesión pasa a aal2 y la prop `hadFactor` cambia.
  const [isFirst] = useState(!hadFactor);
  const [secondDevice, setSecondDevice] = useState(hadFactor);
  const [step, setStep] = useState<Step>({ name: "inicio" });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function start() {
    setError(undefined);
    startTransition(async () => {
      const res = await empezarEnrolamiento();
      if (!res.ok) return setError(res.error);
      setStep({ name: "escanear", factorId: res.factorId, qr: res.qr, secret: res.secret });
    });
  }

  function confirm(formData: FormData) {
    if (step.name !== "escanear") return;
    const factorId = step.factorId;
    setError(undefined);
    startTransition(async () => {
      const res = await confirmarEnrolamiento({ factorId, code: String(formData.get("code") ?? "") });
      if (!res.ok) return setError(res.error);
      setStep({ name: "listo" });
    });
  }

  if (step.name === "listo") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-semibold text-accent">
          <Check className="size-5" aria-hidden /> Dispositivo registrado
        </p>
        {isFirst && !secondDevice ? (
          <>
            <p className="text-sm text-ink-soft">
              Te recomendamos registrar un segundo dispositivo (por ejemplo, el teléfono de otra persona de
              confianza). Si pierdes este, podrás seguir entrando con el otro.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={buttonClass("primary", "lg")}
                onClick={() => {
                  setSecondDevice(true);
                  setStep({ name: "inicio" });
                }}
              >
                Registrar un segundo dispositivo
              </button>
              <Link href="/admin" className={buttonClass("secondary", "lg")}>
                Ahora no, ir al panel
              </Link>
            </div>
          </>
        ) : (
          <Link href="/admin" className={buttonClass("primary", "lg", "w-full")}>
            Ir al panel
          </Link>
        )}
      </div>
    );
  }

  if (step.name === "escanear") {
    return (
      <form action={confirm} className="space-y-4" noValidate>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>Abre tu app de autenticación (Google Authenticator, Authy, 1Password…).</li>
          <li>Escanea este código QR o escribe la clave a mano.</li>
          <li>Escribe aquí el código de 6 dígitos que te muestra.</li>
        </ol>
        <div className="flex justify-center rounded-lg border border-line bg-white p-3">
          {/* Imagen SVG en data URI que entrega Supabase; next/image no aporta aquí. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.qr} alt="Código QR para tu app de autenticación" width={192} height={192} />
        </div>
        <p className="text-center text-sm text-ink-soft">
          ¿No puedes escanear? Clave manual:{" "}
          <code className="break-all rounded bg-soft px-1.5 py-0.5 font-mono text-ink">{step.secret}</code>
        </p>
        <Field
          label="Código de 6 dígitos"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          inputClassName="text-center text-xl tracking-[0.4em]"
        />
        <FormError>{error}</FormError>
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
          {pending ? "Verificando…" : "Confirmar dispositivo"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        {secondDevice
          ? "Vamos a registrar otro dispositivo con su propia app de autenticación."
          : "Para proteger la tienda, el panel pide un código de tu teléfono además de la contraseña. Necesitas una app de autenticación."}
      </p>
      <FormError>{error}</FormError>
      <button type="button" onClick={start} disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? "Preparando…" : "Generar código QR"}
      </button>
    </div>
  );
}
