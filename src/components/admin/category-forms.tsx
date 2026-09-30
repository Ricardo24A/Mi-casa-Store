"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import {
  accionCategoria,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  type CategoryFormState,
} from "@/app/(admin)/admin/(panel)/categorias/actions";
import { buttonClass } from "@/components/ui/button";
import { Field, FormError, SelectField, SubmitButton } from "@/components/ui/form-controls";

const initial: CategoryFormState = {};

/** Activar/desactivar y subir/bajar desde la lista. Cada botón es su propio formulario de servidor. */
export function CategoryRowControls({
  id,
  nombre,
  activa,
  isFirst,
  isLast,
}: {
  id: string;
  nombre: string;
  activa: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(accionCategoria, initial);
  const icon = "inline-flex size-11 items-center justify-center rounded-lg text-ink transition-colors duration-150 hover:bg-bg-alt disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="intent" value="arriba" />
        <button type="submit" disabled={isFirst} className={icon} aria-label={`Subir ${nombre}`}>
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="intent" value="abajo" />
        <button type="submit" disabled={isLast} className={icon} aria-label={`Bajar ${nombre}`}>
          <ArrowDown className="size-4" aria-hidden />
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="intent" value="alternar" />
        <button type="submit" className={buttonClass("ghost", "sm", "gap-2")}>
          {activa ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {activa ? "Desactivar" : "Activar"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="basis-full text-sm text-sale-ink">
          {state.error}
        </p>
      )}
    </div>
  );
}

export interface ParentOption {
  id: string;
  nombre: string;
}

/** Crear o editar. `parents` son las categorías de primer nivel donde puede colgar una subcategoría. */
export function CategoryForm({
  mode,
  id,
  nombre,
  parentId,
  parents,
  parentLocked,
}: {
  mode: "crear" | "editar";
  id?: string;
  nombre: string;
  parentId: string;
  parents: ParentOption[];
  /** Una categoría con subcategorías no puede pasar a ser subcategoría. */
  parentLocked?: boolean;
}) {
  const [state, action] = useActionState(mode === "crear" ? crearCategoria : editarCategoria, initial);
  const e = state.fieldErrors ?? {};
  const v = { nombre, parentId, ...state.values };

  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      <Field label="Nombre" name="nombre" required defaultValue={v.nombre} error={e.nombre} key={`n-${v.nombre}`} />
      {parentLocked ? (
        <>
          <input type="hidden" name="parentId" value="" />
          <p className="text-sm text-ink-soft">
            Es una categoría de primer nivel con subcategorías, así que no puede pasar a ser subcategoría.
          </p>
        </>
      ) : (
        <SelectField
          label="Dentro de"
          name="parentId"
          defaultValue={v.parentId}
          error={e.parentId}
          key={`p-${v.parentId}`}
        >
          <option value="">Ninguna (categoría de primer nivel)</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </SelectField>
      )}
      <FormError>{state.error}</FormError>
      <SubmitButton className="sm:w-auto" pendingLabel="Guardando…">
        {mode === "crear" ? "Crear categoría" : "Guardar cambios"}
      </SubmitButton>
    </form>
  );
}

export function DeleteCategory({ id, nombre, isParent }: { id: string; nombre: string; isParent: boolean }) {
  const [state, action] = useActionState(eliminarCategoria, initial);
  return (
    <details className="max-w-md rounded-card border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-sale-ink">
        Eliminar “{nombre}”
      </summary>
      <form action={action} className="space-y-3 border-t border-line p-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-ink-soft">
          Solo se puede eliminar si no tiene productos{isParent ? " ni subcategorías" : ""}. Si quieres ocultarla de la
          tienda sin borrarla, usa “Desactivar” en la lista.
          {!isParent && " Las plantillas de productos de esta subcategoría también se eliminan."}
        </p>
        <FormError>{state.error}</FormError>
        <SubmitButton variant="secondary" className="text-sale-ink" pendingLabel="Eliminando…">
          Eliminar definitivamente
        </SubmitButton>
      </form>
    </details>
  );
}
