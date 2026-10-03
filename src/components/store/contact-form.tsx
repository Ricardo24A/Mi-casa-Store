"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { enviarMensaje, type ContactFormState } from "@/app/(tienda)/contacto/actions";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { buttonClass } from "@/components/ui/button";
import { Field, FormError, TextareaField } from "@/components/ui/form-controls";
import { formatEcPhoneInput } from "@/lib/phone-ec";
import { CONTACT_FIELDS, CONTACT_LIMITS, charCount } from "@/lib/validation/contact";

const initial: ContactFormState = {};
const empty = { nombre: "", email: "", telefono: "", asunto: "", mensaje: "" };

/**
 * Formulario de /contacto. Lo valida el servidor (Zod, Turnstile y la base de datos); aquí solo se
 * conserva lo escrito, se muestran los errores bajo cada campo y se lleva el foco al primero.
 * `storeName` va en el texto de aceptación del tratamiento de datos.
 */
function Form({ storeName, onReset }: { storeName: string; onReset: () => void }) {
  const [state, action, pending] = useActionState(enviarMensaje, initial);
  // Campos controlados, y el envío se hace a mano (onSubmit) en vez de con `<form action>`: React
  // reinicia el formulario tras una acción y la casilla quedaría desmarcada aunque su estado diga lo
  // contrario. Un error nunca debe borrar lo escrito.
  const [v, setV] = useState(empty);
  const [acepta, setAcepta] = useState(false);
  const set = (key: keyof typeof empty, value: string) => setV((prev) => ({ ...prev, [key]: value }));
  const errorRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const e = state.fieldErrors ?? {};

  // Tras cada respuesta: foco en el primer campo con error, en el aviso general o en la confirmación.
  useEffect(() => {
    if (state.ok) {
      doneRef.current?.focus();
      return;
    }
    const first = CONTACT_FIELDS.find((f) => state.fieldErrors?.[f]);
    if (first) document.getElementById(first)?.focus();
    else if (state.error) errorRef.current?.focus();
  }, [state]);

  if (state.ok) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="rounded-card border border-accent-mid bg-accent-soft p-6 outline-none">
        <p className="flex items-center gap-2 text-lg font-semibold text-accent">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          Recibimos tu mensaje
        </p>
        <p className="mt-2 text-ink">Gracias por escribirnos. Te responderemos al correo o al teléfono que nos dejaste.</p>
        <button type="button" onClick={onReset} className={buttonClass("secondary", "md", "mt-4")}>
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  const count = charCount(v.mensaje.replace(/\r\n?/g, "\n").trim());
  const { min, max } = CONTACT_LIMITS.mensaje;

  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (pending) return;
    const data = new FormData(ev.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate aria-busy={pending}>
      <p className="text-sm text-ink-soft">Los campos con * son obligatorios.</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Nombre *"
          name="nombre"
          autoComplete="name"
          required
          maxLength={CONTACT_LIMITS.nombre.max}
          value={v.nombre}
          onChange={(ev) => set("nombre", ev.target.value)}
          error={e.nombre}
        />
        <Field
          label="Correo *"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={v.email}
          onChange={(ev) => set("email", ev.target.value)}
          error={e.email}
        />
        <Field
          label="Teléfono *"
          name="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={24}
          value={v.telefono}
          onChange={(ev) => set("telefono", formatEcPhoneInput(ev.target.value, v.telefono))}
          error={e.telefono}
          hint="Celular (09…) o fijo con código de provincia."
        />
        <Field
          label="Asunto"
          name="asunto"
          maxLength={CONTACT_LIMITS.asunto.max}
          value={v.asunto}
          onChange={(ev) => set("asunto", ev.target.value)}
          error={e.asunto}
        />
      </div>

      <TextareaField
        label="Mensaje *"
        name="mensaje"
        required
        rows={6}
        value={v.mensaje}
        onChange={(ev) => set("mensaje", ev.target.value)}
        error={e.mensaje}
        hint={
          <span className="flex flex-wrap justify-between gap-x-4">
            <span>
              Entre {min} y {max} caracteres.
            </span>
            <span aria-hidden className={count > max ? "font-semibold text-sale-ink" : undefined}>
              {count} / {max}
            </span>
          </span>
        }
      />

      {/* Campo trampa: invisible y fuera del orden del teclado. Una persona no lo llena; un robot sí. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="sitio_web">No llenes este campo</label>
        <input id="sitio_web" name="sitio_web" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2 text-sm text-ink">
          <input
            id="acepta"
            name="acepta"
            type="checkbox"
            required
            checked={acepta}
            onChange={(ev) => setAcepta(ev.target.checked)}
            aria-invalid={e.acepta ? true : undefined}
            aria-describedby={e.acepta ? "acepta-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span>
            Acepto que {storeName} use mis datos (nombre, correo, teléfono y mensaje) solo para responder esta consulta. *
          </span>
        </label>
        {e.acepta && (
          <p id="acepta-error" className="mt-1 text-sm text-sale-ink">
            {e.acepta}
          </p>
        )}
      </div>

      <TurnstileWidget resetKey={state} />
      <div ref={errorRef} tabIndex={-1} className="outline-none">
        <FormError>{state.error}</FormError>
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? "Enviando…" : "Enviar mensaje"}
      </button>
      <p className="text-sm text-ink-soft">
        Más información en nuestra{" "}
        <Link href="/privacidad" className="font-semibold text-accent underline underline-offset-4 hover:no-underline">
          Política de Privacidad
        </Link>
        .
      </p>
    </form>
  );
}

/** Envoltorio: "Enviar otro mensaje" monta un formulario nuevo, vacío y con su estado inicial. */
export function ContactForm({ storeName }: { storeName: string }) {
  const [round, setRound] = useState(0);
  return <Form key={round} storeName={storeName} onReset={() => setRound((r) => r + 1)} />;
}
