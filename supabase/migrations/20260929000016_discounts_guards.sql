-- Descuentos: que no puedan aplicar mal.
--
-- La tabla ya exigía valor > 0, porcentaje <= 100, fechas coherentes (termina > inicia) y que el destino
-- exista solo cuando el alcance no es "toda la tienda". Faltaba lo que la base de datos no podía ver:
--   1. Un 100% dejaba un producto gratis. Ahora el porcentaje es menor que 100 (y la lógica de precios,
--      además, nunca baja de 1 centavo).
--   2. `target_id` apunta a un producto o a una categoría según el alcance, pero sin clave foránea: un
--      descuento podía apuntar a algo que no existe (no aplica a nada y confunde) o quedar colgado al borrar
--      el producto o la categoría. Se valida al guardar y se limpia al borrar.
-- Los permisos no cambian: lectura pública solo de los automáticos y vigentes; escritura solo del
-- administrador con 2FA (is_admin()). Las pruebas de rls.test.sql los comprueban de nuevo.

-- ---------------------------------------------------------------------------
-- 1) Porcentaje estrictamente menor que 100
-- ---------------------------------------------------------------------------
update public.discounts set valor = 99.99 where tipo = 'porcentaje' and valor >= 100;

alter table public.discounts drop constraint discounts_porcentaje_valido;
alter table public.discounts
  add constraint discounts_porcentaje_valido check (tipo <> 'porcentaje' or valor < 100);

-- ---------------------------------------------------------------------------
-- 2) El destino debe existir y ser del tipo que dice el alcance
-- ---------------------------------------------------------------------------
create function public.discounts_check_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.alcance = 'producto' and not exists (select 1 from public.products p where p.id = new.target_id) then
    raise exception 'destino_invalido' using errcode = 'check_violation';
  end if;
  if new.alcance = 'categoria' and not exists (select 1 from public.categories c where c.id = new.target_id) then
    raise exception 'destino_invalido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger discounts_target
  before insert or update of alcance, target_id on public.discounts
  for each row execute function public.discounts_check_target();

-- ---------------------------------------------------------------------------
-- 3) Al borrar un producto o una categoría, se borran los descuentos que apuntaban a ellos
-- ---------------------------------------------------------------------------
create function public.discounts_cleanup_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.discounts where alcance = 'producto' and target_id = old.id;
  return old;
end;
$$;

create function public.discounts_cleanup_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.discounts where alcance = 'categoria' and target_id = old.id;
  return old;
end;
$$;

create trigger products_discounts_cleanup
  after delete on public.products
  for each row execute function public.discounts_cleanup_product();

create trigger categories_discounts_cleanup
  after delete on public.categories
  for each row execute function public.discounts_cleanup_category();

revoke all on function public.discounts_check_target() from public, anon, authenticated;
revoke all on function public.discounts_cleanup_product() from public, anon, authenticated;
revoke all on function public.discounts_cleanup_category() from public, anon, authenticated;
