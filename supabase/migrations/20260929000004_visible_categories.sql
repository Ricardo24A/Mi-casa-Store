-- Visibilidad de categorías (CLAUDE.md sección 4).
-- La tienda solo muestra lo que tiene productos; las categorías siguen existiendo en la base
-- de datos para que el dueño pueda dar de alta productos.
--
--   * Subcategoría visible: tiene al menos un producto ACTIVO.
--   * Categoría visible: alguna de sus subcategorías visibles tiene productos.
--   * Un producto agotado (stock 0) pero activo cuenta; para ocultarlo se desactiva.
--
-- security_invoker = true: la vista se ejecuta con los permisos y RLS de quien consulta.
-- El filtro `p.activo` es explícito a propósito: la política de products deja al admin ver
-- también los inactivos, y la tienda no debe mostrar categorías por productos inactivos
-- ni siquiera cuando quien navega es el admin.

create view public.visible_categories
with (security_invoker = true)
as
select
  c.id,
  c.parent_id,
  c.nombre,
  c.slug,
  c.imagen_url,
  c.orden,
  c.created_at
from public.categories c
where
  case
    when c.parent_id is not null then exists (
      select 1
      from public.products p
      where p.category_id = c.id and p.activo
    )
    else exists (
      select 1
      from public.categories s
      join public.products p on p.category_id = s.id
      where s.parent_id = c.id and p.activo
    )
  end;

-- Los permisos están cerrados por defecto en este esquema, pero no se depende de eso: si algún
-- día los permisos por defecto del proyecto se abrieran, una vista simple es actualizable y
-- quedaría escribible desde la API. Se quita todo y se concede solo la lectura.
revoke all on public.visible_categories from anon, authenticated;
grant select on public.visible_categories to anon, authenticated, service_role;
