-- Categorías del dashboard: activar y desactivar, dos niveles, nombres únicos y orden.
--
-- "Activa" es distinto de "visible":
--   * visible  = la tienda la muestra porque tiene productos activos (CLAUDE.md, sección 4).
--   * activa   = el dueño no la ha ocultado a propósito. Una categoría desactivada desaparece de la
--                tienda con sus subcategorías y sus productos (menú, filtros, búsqueda, ficha,
--                sitemap), aunque tenga productos activos. El dashboard la sigue mostrando.

-- ---------------------------------------------------------------------------
-- 1) Columna `activa`
-- ---------------------------------------------------------------------------
alter table public.categories add column activa boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2) ¿La tienda puede mostrar esta categoría? (ella y, si es subcategoría, su padre están activas)
-- ---------------------------------------------------------------------------
create function public.category_visible(p_category_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.categories c
    left join public.categories parent on parent.id = c.parent_id
    where c.id = p_category_id
      and c.activa
      and (c.parent_id is null or parent.activa)
  );
$$;

revoke all on function public.category_visible(uuid) from public;
grant execute on function public.category_visible(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) La vista `visible_categories` respeta `activa`
-- ---------------------------------------------------------------------------
-- Mismas columnas que antes, así que se reemplaza sin perder permisos. Sigue siendo security_invoker.
create or replace view public.visible_categories
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
  c.activa
  and case
    when c.parent_id is not null then
      exists (select 1 from public.categories parent where parent.id = c.parent_id and parent.activa)
      and exists (select 1 from public.products p where p.category_id = c.id and p.activo)
    else exists (
      select 1
      from public.categories s
      join public.products p on p.category_id = s.id
      where s.parent_id = c.id and s.activa and p.activo
    )
  end;

-- ---------------------------------------------------------------------------
-- 4) Los productos de una categoría desactivada no se ven en la tienda
-- ---------------------------------------------------------------------------
-- El administrador (con 2FA) sigue viéndolos todos. Las imágenes heredan esta regla porque su política
-- consulta `products` bajo RLS.
drop policy products_select on public.products;
create policy products_select on public.products
  for select to anon, authenticated
  using ((activo and public.category_visible(category_id)) or public.is_admin());

-- ---------------------------------------------------------------------------
-- 5) Dos niveles (categoría -> subcategoría) y nombres únicos
-- ---------------------------------------------------------------------------
create function public.categories_two_levels()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    -- El padre debe ser una categoría de primer nivel.
    if exists (select 1 from public.categories p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'solo_dos_niveles' using errcode = 'check_violation';
    end if;
    -- Una categoría que ya tiene subcategorías no puede pasar a ser subcategoría.
    if exists (select 1 from public.categories c where c.parent_id = new.id) then
      raise exception 'solo_dos_niveles' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_two_levels
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_two_levels();

-- Nombre único dentro del mismo padre (sin distinguir mayúsculas). Si ya hubiera nombres repetidos,
-- no se crea el índice y se avisa: el dueño los corrige y se vuelve a ejecutar esta sentencia.
do $$
begin
  create unique index categories_unique_name
    on public.categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
exception when unique_violation then
  raise notice 'Hay categorías con el mismo nombre dentro de un mismo padre; corrígelas y crea el índice categories_unique_name.';
end $$;

-- ---------------------------------------------------------------------------
-- 6) Ordenar con flechas (sube o baja una posición entre sus hermanas)
-- ---------------------------------------------------------------------------
-- Bloquea a las hermanas, numera su orden de 0 a n-1 sin huecos y intercambia la posición. Es una
-- función para que dos clics seguidos no dejen el orden a medias.
create function public.admin_move_category(p_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent uuid;
  v_ids uuid[];
  v_pos integer;
  v_target integer;
  v_tmp uuid;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = 'P0001';
  end if;
  if p_direction not in ('arriba', 'abajo') then
    raise exception 'direccion_invalida' using errcode = 'P0001';
  end if;

  select c.parent_id into v_parent from public.categories c where c.id = p_id;
  if not found then
    raise exception 'categoria_no_encontrada' using errcode = 'P0001';
  end if;

  perform 1 from public.categories c where c.parent_id is not distinct from v_parent order by c.id for update;

  select array_agg(c.id order by c.orden, c.nombre, c.id) into v_ids
  from public.categories c
  where c.parent_id is not distinct from v_parent;

  v_pos := array_position(v_ids, p_id);
  v_target := case when p_direction = 'arriba' then v_pos - 1 else v_pos + 1 end;

  if v_target >= 1 and v_target <= array_length(v_ids, 1) then
    v_tmp := v_ids[v_target];
    v_ids[v_target] := v_ids[v_pos];
    v_ids[v_pos] := v_tmp;
  end if;

  update public.categories c
     set orden = t.n
    from (select u.id, (u.ord - 1)::integer as n from unnest(v_ids) with ordinality as u(id, ord)) t
   where c.id = t.id and c.orden is distinct from t.n;
end;
$$;

revoke all on function public.admin_move_category(uuid, text) from public, anon;
grant execute on function public.admin_move_category(uuid, text) to authenticated;
