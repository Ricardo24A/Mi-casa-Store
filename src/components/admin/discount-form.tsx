"use client";

import { useActionState, useMemo, useState } from "react";
import { crearDescuento, editarDescuento, type DiscountFormState } from "@/app/(admin)/admin/(panel)/descuentos/actions";
import { Field, FormError, SelectField, SubmitButton, inputClass } from "@/components/ui/form-controls";
import { DISCOUNT_RULES, SCOPE_LABEL, type DiscountKind, type DiscountScope } from "@/lib/discount-rules";
import { previewPrice } from "@/lib/discount-preview";
import type { DiscountFormContext } from "@/lib/admin-discounts";
import { formatUsd } from "@/lib/format";

export interface DiscountDefaults {
  nombre: string;
  tipo: DiscountKind;
  valor: string;
  alcance: DiscountScope;
  targetId: string;
  /** Hora de Ecuador, formato de un campo datetime-local. */
  inicia: string;
  termina: string;
  activo: boolean;
}

const initial: DiscountFormState = {};
const MANUAL = "__manual__";

export function DiscountForm({
  mode,
  id,
  defaults,
  context,
}: {
  mode: "crear" | "editar";
  id?: string;
  defaults: DiscountDefaults;
  context: DiscountFormContext;
}) {
  const [state, action] = useActionState(mode === "crear" ? crearDescuento : editarDescuento, initial);
  // Campos controlados: si el servidor devuelve un error, el formulario no se vacía.
  const [v, setV] = useState(defaults);
  const set = <K extends keyof DiscountDefaults>(key: K, value: DiscountDefaults[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const e = state.fieldErrors ?? {};

  // ---- Vista previa ----------------------------------------------------------------------
  const [sampleId, setSampleId] = useState("");
  const [manualPrice, setManualPrice] = useState("50");

  const relevant = useMemo(() => {
    if (v.alcance === "producto") return context.products.filter((p) => p.id === v.targetId);
    if (v.alcance === "categoria") {
      return context.products.filter((p) => p.category_id === v.targetId || context.parents[p.category_id] === v.targetId);
    }
    return context.products;
  }, [v.alcance, v.targetId, context.products, context.parents]);

  const sample = sampleId === MANUAL ? null : (relevant.find((p) => p.id === sampleId) ?? relevant[0] ?? null);
  const manual = Number(manualPrice.replace(",", "."));
  const product = sample
    ? { id: sample.id, category_id: sample.category_id, precio: sample.precio }
    : Number.isFinite(manual) && manual > 0
      ? {
          id: v.alcance === "producto" ? v.targetId : "__muestra__",
          category_id: v.alcance === "categoria" ? v.targetId : "__sin_categoria__",
          precio: manual,
        }
      : null;

  const preview = product
    ? previewPrice({
        form: { tipo: v.tipo, valor: v.valor, alcance: v.alcance, targetId: v.targetId, inicia: v.inicia, termina: v.termina },
        product,
        others: context.others,
        parents: context.parents,
        now: new Date(),
      })
    : { kind: "incompleto" as const };

  const transfer =
    preview.kind === "ok" && context.transferPct > 0 ? Math.round((preview.conEste * 100 * context.transferPct) / 100) / 100 : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={action} className="max-w-2xl space-y-5" noValidate>
        {id && <input type="hidden" name="id" value={id} />}
        <Field label="Nombre *" name="nombre" required value={v.nombre} onChange={(ev) => set("nombre", ev.target.value)} error={e.nombre} maxLength={120} hint="Solo lo ves tú: por ejemplo “Fin de semana de cocina”." />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Tipo *" name="tipo" value={v.tipo} onChange={(ev) => set("tipo", ev.target.value as DiscountKind)} error={e.tipo}>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto_fijo">Monto fijo (USD por unidad)</option>
          </SelectField>
          <Field
            label={v.tipo === "porcentaje" ? "Porcentaje *" : "Monto (USD) *"}
            name="valor"
            inputMode="decimal"
            required
            value={v.valor}
            onChange={(ev) => set("valor", ev.target.value)}
            error={e.valor}
            hint={v.tipo === "porcentaje" ? "Mayor que 0 y menor que 100." : "Se descuenta por cada unidad."}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Se aplica a *"
            name="alcance"
            value={v.alcance}
            onChange={(ev) => {
              set("alcance", ev.target.value as DiscountScope);
              set("targetId", "");
              setSampleId("");
            }}
            error={e.alcance}
          >
            {(Object.keys(SCOPE_LABEL) as DiscountScope[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </SelectField>

          {v.alcance === "categoria" && (
            <SelectField label="Categoría *" name="targetId" value={v.targetId} onChange={(ev) => set("targetId", ev.target.value)} error={e.targetId}>
              <option value="">Elige una categoría</option>
              {context.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectField>
          )}
          {v.alcance === "producto" && (
            <SelectField label="Producto *" name="targetId" value={v.targetId} onChange={(ev) => set("targetId", ev.target.value)} error={e.targetId}>
              <option value="">Elige un producto</option>
              {context.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </SelectField>
          )}
          {v.alcance === "tienda" && <input type="hidden" name="targetId" value="" />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Empieza (hora de Ecuador)"
            name="inicia"
            type="datetime-local"
            value={v.inicia}
            onChange={(ev) => set("inicia", ev.target.value)}
            error={e.inicia}
            hint={mode === "crear" ? "Vacío = desde ahora." : "Vacío = conserva el inicio actual."}
          />
          <Field
            label="Termina (hora de Ecuador)"
            name="termina"
            type="datetime-local"
            value={v.termina}
            onChange={(ev) => set("termina", ev.target.value)}
            error={e.termina}
            hint="Vacío = sin fecha de fin."
          />
        </div>

        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="activo" checked={v.activo} onChange={(ev) => set("activo", ev.target.checked)} className="size-5 accent-accent" />
          <span className="text-sm text-ink">Activo (si está apagado no se aplica aunque esté en fechas)</span>
        </label>

        <FormError>{state.error}</FormError>
        <SubmitButton className="sm:w-auto" pendingLabel="Guardando…">
          {mode === "crear" ? "Crear descuento" : "Guardar cambios"}
        </SubmitButton>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Vista previa">
        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="text-lg font-semibold text-ink">Vista previa</h2>
          <p className="mb-3 text-sm text-ink-soft">Así se vería el precio. Solo es una guía: el precio real lo calcula el servidor.</p>

          <label htmlFor="muestra" className="mb-1 block text-sm font-semibold text-ink">
            Producto de ejemplo
          </label>
          <select
            id="muestra"
            value={sample ? sample.id : MANUAL}
            onChange={(ev) => setSampleId(ev.target.value)}
            className={inputClass}
          >
            {relevant.slice(0, 200).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {formatUsd(p.precio)}
              </option>
            ))}
            <option value={MANUAL}>Otro precio…</option>
          </select>
          {!sample && (
            <div className="mt-2">
              <Field label="Precio de ejemplo (USD)" name="precio-ejemplo" inputMode="decimal" value={manualPrice} onChange={(ev) => setManualPrice(ev.target.value)} />
            </div>
          )}

          <div className="mt-4 border-t border-line pt-4" aria-live="polite">
            {preview.kind === "incompleto" ? (
              <p className="text-sm text-ink-soft">Completa el tipo, el valor y a qué se aplica para ver el precio.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-soft">Precio de lista</span>
                  <span className="text-ink">{formatUsd(preview.precioLista)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-ink">Precio final</span>
                  <span className="text-2xl font-semibold text-accent">{formatUsd(preview.conEste)}</span>
                </div>
                {preview.conEste < preview.precioLista && (
                  <p className="text-ink-soft">Rebaja de {formatUsd(preview.precioLista - preview.conEste)}.</p>
                )}
                {transfer > 0 && (
                  <p className="text-ink-soft">
                    Pagando por transferencia ({context.transferPct} % más): <span className="font-semibold text-ink">{formatUsd(preview.conEste - transfer)}</span>.
                  </p>
                )}
                {preview.fueraDeAlcance && (
                  <p role="note" className="rounded-lg bg-sale-soft px-3 py-2 text-sale-ink">
                    Este descuento no se aplica al producto de ejemplo (no es del producto o de la categoría elegida).
                  </p>
                )}
                {!preview.fueraDeAlcance && !preview.aplica && preview.ganador && (
                  <p role="note" className="rounded-lg bg-sale-soft px-3 py-2 text-sale-ink">
                    A este producto ya se le aplica “{preview.ganador.nombre}” porque rebaja más. Este no cambiaría el precio.
                  </p>
                )}
                {preview.vigencia === "programado" && <p className="text-ink-soft">Aún no empieza: se verá desde la fecha de inicio.</p>}
                {preview.vigencia === "vencido" && <p className="text-sale-ink">Con esas fechas ya venció: no se aplicaría.</p>}
                {!v.activo && <p className="text-ink-soft">Está apagado: no se aplicaría hasta activarlo.</p>}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-4">
          <h2 className="mb-2 text-base font-semibold text-ink">Cómo se aplican los descuentos</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            {DISCOUNT_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
