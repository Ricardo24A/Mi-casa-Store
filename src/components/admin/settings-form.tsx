"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { guardarConfiguracion, type SettingsFormState } from "@/app/(admin)/admin/(panel)/configuracion/actions";
import { buttonClass } from "@/components/ui/button";
import { Field, FormError, FormSuccess, SelectField, SubmitButton } from "@/components/ui/form-controls";
import type { SettingsDefaults } from "@/lib/admin-settings";
import { formatEcPhoneInput, normalizeEcPhone } from "@/lib/phone-ec";
import { MAX_BANK_ACCOUNTS, MAX_PAYMENT_HOURS } from "@/lib/validation/admin-settings";

const initial: SettingsFormState = {};

type Row = SettingsDefaults["cuentas"][number] & { key: number };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-ink-soft">{description}</p>}
      <div className={description ? "space-y-4" : "mt-4 space-y-4"}>{children}</div>
    </section>
  );
}

/**
 * Teléfono del negocio: formato mientras se escribe (099 123 4567 / (04) 234 5678); lo guardado son
 * solo dígitos. Avisa si es celular (saldrá el logo de WhatsApp en el pie) o fijo.
 */
function PhoneField({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const parsed = value.trim() === "" ? null : normalizeEcPhone(value);
  const kind = parsed?.ok ? parsed.kind : null;
  return (
    <Field
      label={label}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      maxLength={24}
      value={value}
      onChange={(ev) => onChange(formatEcPhoneInput(ev.target.value, value))}
      error={error}
      hint={
        kind === "celular"
          ? "Celular: en el pie saldrá con el logo de WhatsApp."
          : kind === "fijo"
            ? "Fijo: se mostrará sin WhatsApp."
            : "Celular (09…) o fijo con código de provincia"
      }
    />
  );
}

export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const [state, action] = useActionState(guardarConfiguracion, initial);
  // Campos controlados: React vacía un formulario no controlado tras enviarlo, y un error no debe borrar lo escrito.
  const [v, setV] = useState<Omit<SettingsDefaults, "cuentas">>(() => ({ ...defaults, cuentas: undefined }) as Omit<SettingsDefaults, "cuentas">);
  const set = (key: keyof typeof v, value: string) => setV((prev) => ({ ...prev, [key]: value }));

  const nextKey = useRef(defaults.cuentas.length);
  const [rows, setRows] = useState<Row[]>(() => defaults.cuentas.map((c, i) => ({ ...c, key: i })));
  const setRow = (key: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      <Section title="Negocio y contacto" description="El nombre, el correo, el teléfono, la dirección y Facebook se muestran en el pie de la tienda. Solo aparece lo que completes.">
        <Field label="Nombre del negocio *" name="nombre_negocio" required maxLength={80} value={v.nombre_negocio} onChange={(ev) => set("nombre_negocio", ev.target.value)} error={e.nombre_negocio} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Correo de contacto" name="email_contacto" type="email" maxLength={254} value={v.email_contacto} onChange={(ev) => set("email_contacto", ev.target.value)} error={e.email_contacto} />
          <PhoneField label="Teléfono principal" name="telefono" value={v.telefono} onChange={(next) => set("telefono", next)} error={e.telefono} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneField label="Teléfono secundario (opcional)" name="telefono_secundario" value={v.telefono_secundario} onChange={(next) => set("telefono_secundario", next)} error={e.telefono_secundario} />
        </div>
        <Field label="Dirección" name="direccion" maxLength={200} value={v.direccion} onChange={(ev) => set("direccion", ev.target.value)} error={e.direccion} />
        <Field
          label="Facebook"
          name="facebook"
          type="url"
          inputMode="url"
          placeholder="https://www.facebook.com/…"
          value={v.facebook}
          onChange={(ev) => set("facebook", ev.target.value)}
          error={e.facebook}
          hint="Vacío = no se muestra el icono."
        />
      </Section>

      <Section title="Cuentas para la transferencia" description="Es lo que ve el cliente al pagar. Sin ninguna cuenta, la tienda no deja finalizar compras.">
        <input type="hidden" name="cuentas.count" value={rows.length} />
        {rows.length === 0 && <p className="rounded-lg bg-sale-soft px-3 py-2 text-sm text-sale-ink">No hay cuentas: los clientes no podrán finalizar su compra.</p>}
        <ul className="space-y-4">
          {rows.map((r, i) => (
            <li key={r.key} className="space-y-4 rounded-lg border border-line p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">Cuenta {i + 1}</h3>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-sale-ink hover:bg-sale-soft"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Quitar<span className="sr-only"> cuenta {i + 1}</span>
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Banco *" name={`cuentas.${i}.banco`} maxLength={80} value={r.banco} onChange={(ev) => setRow(r.key, "banco", ev.target.value)} error={e[`cuentas.${i}.banco`]} />
                <SelectField label="Tipo de cuenta *" name={`cuentas.${i}.tipo`} value={r.tipo} onChange={(ev) => setRow(r.key, "tipo", ev.target.value)} error={e[`cuentas.${i}.tipo`]}>
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </SelectField>
                <Field label="Número de cuenta *" name={`cuentas.${i}.numero`} inputMode="numeric" maxLength={25} value={r.numero} onChange={(ev) => setRow(r.key, "numero", ev.target.value)} error={e[`cuentas.${i}.numero`]} />
                <Field label="Identificación del titular *" name={`cuentas.${i}.identificacion`} maxLength={20} value={r.identificacion} onChange={(ev) => setRow(r.key, "identificacion", ev.target.value)} error={e[`cuentas.${i}.identificacion`]} hint="Cédula o RUC." />
                <Field className="sm:col-span-2" label="Titular *" name={`cuentas.${i}.titular`} maxLength={120} value={r.titular} onChange={(ev) => setRow(r.key, "titular", ev.target.value)} error={e[`cuentas.${i}.titular`]} />
              </div>
            </li>
          ))}
        </ul>
        {e.cuentas && <p className="text-sm text-sale-ink">{e.cuentas}</p>}
        <button
          type="button"
          disabled={rows.length >= MAX_BANK_ACCOUNTS}
          onClick={() =>
            setRows((prev) => [...prev, { key: nextKey.current++, banco: "", tipo: "ahorros", numero: "", titular: "", identificacion: "" }])
          }
          className={buttonClass("secondary", "md", "gap-2")}
        >
          <Plus className="size-4" aria-hidden />
          Añadir cuenta
        </button>
      </Section>

      <Section title="Envío y descuento" description="Déjalo vacío si el negocio aún no lo definió: el envío se mostrará como “A coordinar”.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Costo de envío (USD)" name="costo_envio" inputMode="decimal" value={v.costo_envio} onChange={(ev) => set("costo_envio", ev.target.value)} error={e.costo_envio} hint="Vacío = a coordinar. 0 = envío gratis para todos." />
          <Field label="Envío gratis desde (USD)" name="envio_gratis_desde" inputMode="decimal" value={v.envio_gratis_desde} onChange={(ev) => set("envio_gratis_desde", ev.target.value)} error={e.envio_gratis_desde} hint="Vacío = sin envío gratis por monto." />
        </div>
        <Field label="Descuento por pagar con transferencia (%) *" name="descuento_transferencia_pct" inputMode="decimal" value={v.descuento_transferencia_pct} onChange={(ev) => set("descuento_transferencia_pct", ev.target.value)} error={e.descuento_transferencia_pct} hint="0 = sin descuento. Debe ser menor que 100." />
      </Section>

      <Section title="Pedidos e inventario">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plazo para pagar (horas) *" name="horas_limite_pago" inputMode="numeric" value={v.horas_limite_pago} onChange={(ev) => set("horas_limite_pago", ev.target.value)} error={e.horas_limite_pago} hint={`De 1 a ${MAX_PAYMENT_HOURS}. Mientras corre, el stock queda reservado; aplica a los pedidos nuevos.`} />
          <Field label="Umbral de poco stock (unidades) *" name="umbral_stock_bajo" inputMode="numeric" value={v.umbral_stock_bajo} onChange={(ev) => set("umbral_stock_bajo", ev.target.value)} error={e.umbral_stock_bajo} hint="Con esta cantidad o menos, el producto se marca con poco stock." />
        </div>
      </Section>

      <FormError>{state.error}</FormError>
      <FormSuccess>{state.saved ? "Configuración guardada." : undefined}</FormSuccess>
      <SubmitButton className="sm:w-auto" pendingLabel="Guardando…">
        Guardar configuración
      </SubmitButton>
    </form>
  );
}
