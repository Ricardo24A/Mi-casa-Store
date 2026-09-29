-- Dashboard: el admin necesita segundo factor (aal2) y los ajustes ganan dos columnas.
--
-- 1) is_admin() exige, además del rol, que la sesión haya pasado el 2FA (claim `aal` = 'aal2').
--    Así RLS y las políticas de storage rechazan a un admin con solo contraseña (aal1), aunque
--    alguien llame a la API directamente y se salte el proxy de Next.js.
--    `profiles_select` NO cambia: la condición `id = auth.uid()` sigue dejando que un admin en
--    aal1 lea su propia fila, que es lo que necesita el proxy para decidir si lo manda a
--    enrolar o a verificar el código.
--    El claim `aal` lo firma Supabase Auth en el JWT; el cliente no puede modificarlo.
--    Se cambia el cuerpo con `create or replace`: mismo nombre y firma, así que los grants y
--    todas las políticas que la llaman siguen intactos.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    );
$$;

-- 2) Ajustes que faltaban según la sección 5 de CLAUDE.md.
alter table public.store_settings
  -- Un producto con stock disponible menor o igual a este número cuenta como "poco stock".
  add column umbral_stock_bajo integer not null default 5
    check (umbral_stock_bajo between 0 and 1000),
  -- Enlaces públicos de redes, por ejemplo {"facebook": "https://..."}. Validado con Zod.
  add column enlaces_redes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(enlaces_redes) = 'object');
