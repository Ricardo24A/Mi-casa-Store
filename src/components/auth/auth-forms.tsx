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
import { AcceptTerms } from "@/components/legal/accept-terms";
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
      <AcceptTerms error={e.acepta} defaultChecked={state.values?.acepta === "on"} key={`a-${state.values?.acepta}`} />
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

/**
 * Contraseña nueva. `needsCurrent`: pedir la actual (sesión normal, no el enlace del correo).
 * `needsCode`: pedir el código de 2 pasos (administrador). Si sale bien, la acción cierra la sesión
 * y lleva al login; un error conserva la pantalla con el mensaje bajo cada campo.
 */
export function NewPasswordForm({ needsCurrent, needsCode }: { needsCurrent: boolean; needsCode: boolean }) {
  const [state, action] = useActionState(guardarNuevaClave, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {needsCurrent && (
        <Field
          label="Contraseña actual"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          error={e.current}
        />
      )}
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
      {needsCode && (
        <Field
          label="Código de 2 pasos"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          hint="Los 6 dígitos de tu app de autenticación."
          error={e.code}
        />
      )}
      <p className="text-sm text-ink-soft">Al guardarla se cerrará tu sesión en todos tus dispositivos y volverás a iniciar sesión.</p>
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
      {needsCurrent && (
        <p className="text-center text-sm">
          <Link href="/recuperar" className="inline-flex min-h-11 items-center text-accent hover:underline">
            Olvidé mi contraseña actual
          </Link>
        </p>
      )}
    </form>
  );
}
