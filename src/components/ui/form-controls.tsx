"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-soft focus-visible:border-accent aria-[invalid=true]:border-sale-ink";

interface FieldExtras {
  label: string;
  hint?: ReactNode;
  /** Mensaje de error del campo (de la validación en servidor). */
  error?: string;
  inputClassName?: string;
}

export function Field({
  label,
  hint,
  error,
  className,
  inputClassName,
  ...props
}: FieldExtras & ComponentProps<"input">) {
  const id = props.id ?? props.name;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
        className={cn(inputClass, inputClassName)}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-sale-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  error,
  className,
  children,
  ...props
}: { label: string; error?: string } & ComponentProps<"select">) {
  const id = props.id ?? props.name;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        className={inputClass}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-sale-ink">
          {error}
        </p>
      )}
    </div>
  );
}

/** Mensaje de error de un formulario. `role="alert"` para que lo lea el lector de pantalla. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">
      {children}
    </p>
  );
}

/** Mensaje de éxito de un formulario (`role="status"`). */
export function FormSuccess({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
      {children}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Un momento…",
  className,
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, "lg", cn("w-full", className))}>
      {pending ? pendingLabel : children}
    </button>
  );
}
