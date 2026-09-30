"use client";

import { useActionState } from "react";
import type { AccountFormState } from "@/app/(acceso)/actions";
import { guardarDatos, guardarDireccion } from "@/app/(tienda)/cuenta/actions";
import { Field, FormError, FormSuccess, SelectField, SubmitButton } from "@/components/ui/form-controls";
import { PROVINCIAS } from "@/config/ecuador";

const initial: AccountFormState = {};

export function ProfileForm({ email, fullName, phone }: { email: string; fullName: string; phone: string }) {
  const [state, action] = useActionState(guardarDatos, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      <Field label="Correo" value={email} readOnly disabled hint="Para cambiar el correo, escríbenos." />
      <Field
        label="Nombre completo"
        name="full_name"
        autoComplete="name"
        required
        defaultValue={state.values?.full_name ?? fullName}
        error={e.full_name}
      />
      <Field
        label="Teléfono"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={state.values?.phone ?? phone}
        error={e.phone}
      />
      <FormError>{state.error}</FormError>
      <FormSuccess>{state.ok}</FormSuccess>
      <SubmitButton className="sm:w-auto" pendingLabel="Guardando…">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}

export interface AddressValues {
  id?: string;
  etiqueta: string;
  destinatario: string;
  telefono: string;
  provincia: string;
  ciudad: string;
  direccion: string;
  referencia: string;
  es_predeterminada: boolean;
}

export function AddressForm({ initialValues }: { initialValues: AddressValues }) {
  const [state, action] = useActionState(guardarDireccion, initial);
  const e = state.fieldErrors ?? {};
  const v = { ...initialValues, ...state.values };
  return (
    <form action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
      {initialValues.id && <input type="hidden" name="id" value={initialValues.id} />}
      <Field label="Nombre de la dirección" name="etiqueta" required placeholder="Casa, Trabajo…" defaultValue={v.etiqueta} error={e.etiqueta} />
      <Field label="Quién recibe" name="destinatario" autoComplete="name" required defaultValue={v.destinatario} error={e.destinatario} />
      <Field label="Teléfono de contacto" name="telefono" type="tel" autoComplete="tel" required defaultValue={v.telefono} error={e.telefono} />
      <SelectField label="Provincia" name="provincia" required defaultValue={v.provincia} error={e.provincia}>
        <option value="">Elige una provincia</option>
        {PROVINCIAS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </SelectField>
      <Field label="Ciudad" name="ciudad" required defaultValue={v.ciudad} error={e.ciudad} />
      <Field label="Dirección" name="direccion" autoComplete="street-address" required defaultValue={v.direccion} error={e.direccion} hint="Calle principal, número y calle secundaria." />
      <Field className="sm:col-span-2" label="Referencia (opcional)" name="referencia" defaultValue={v.referencia} error={e.referencia} hint="Por ejemplo: junto al parque, casa blanca de dos pisos." />
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
        <input type="checkbox" name="es_predeterminada" defaultChecked={v.es_predeterminada} className="size-5 accent-accent" />
        <span className="text-sm text-ink">Usar como dirección principal</span>
      </label>
      <div className="space-y-4 sm:col-span-2">
        <FormError>{state.error}</FormError>
        <SubmitButton className="sm:w-auto" pendingLabel="Guardando…">
          Guardar dirección
        </SubmitButton>
      </div>
    </form>
  );
}
