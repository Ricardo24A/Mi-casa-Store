"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  guardarNuevaClave,
  iniciarSesion,
  registrar,
  solicitarRecuperacion,
  type AccountFormState,
} from "@/app/(acceso)/actions";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/ui/form-controls";

const initial: AccountFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(iniciarSesion, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state.values?.email}
        key={state.values?.email}
      />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required />
      <TurnstileWidget resetKey={state} />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/recuperar" className="inline-flex min-h-11 items-center text-accent hover:underline">
          Olvidé mi contraseña
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registrar, initial);
  const e = state.fieldErrors ?? {};
  if (state.ok) return <FormSuccess>{state.ok}</FormSuccess>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="Nombre completo"
        name="nombre"
        autoComplete="name"
        required
        defaultValue={state.values?.nombre}
        error={e.nombre}
        key={`n-${state.values?.nombre}`}
      />
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={e.email}
        key={`e-${state.values?.email}`}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 10 caracteres."
        error={e.password}
      />
      <Field
        label="Repite la contraseña"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={e.confirm}
      />
      <TurnstileWidget resetKey={state} />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}

export function RecoverForm() {
  const [state, action] = useActionState(solicitarRecuperacion, initial);
  if (state.ok) return <FormSuccess>{state.ok}</FormSuccess>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        key={state.values?.email}
      />
      <TurnstileWidget resetKey={state} />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(guardarNuevaClave, initial);
  const e = state.fieldErrors ?? {};
  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormSuccess>{state.ok}</FormSuccess>
        <Link href="/cuenta" className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
          Ir a mi cuenta
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 10 caracteres."
        error={e.password}
      />
      <Field
        label="Repite la contraseña"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={e.confirm}
      />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
