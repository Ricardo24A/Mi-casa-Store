-- Cuentas de clientes: nombre desde el registro, direcciones de envío y diseño de orders.user_id.

-- 1) El perfil nace siempre como 'customer'. El rol está escrito aquí, NUNCA se lee de
--    raw_user_meta_data (ese JSON lo puede escribir el propio usuario al registrarse o con
--    updateUser). Solo se copia el nombre, recortado y con largo máximo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'customer',
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  );
  return new;
end;
$$;

-- 2) orders.user_id soporta las dos políticas de compra (CLAUDE.md §15):
--      · invitado:   user_id es null y el pedido se consulta con su access_token (lo hace el servidor)
--      · con cuenta: el servidor guarda user_id = auth.uid() y el cliente lo ve por RLS
--    Si el cliente borra su cuenta el pedido se conserva (on delete set null), porque es un
--    registro de venta. El índice orders_user_idx ya existe. La regla vigente se define en
--    src/config/site.ts (CHECKOUT_REQUIRES_ACCOUNT).
comment on column public.orders.user_id is
  'Cliente con cuenta que hizo el pedido; null = compra como invitado (se consulta con access_token).';

-- 3) Direcciones de envío del cliente (máximo 10 por cuenta).
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  etiqueta text not null check (char_length(etiqueta) between 1 and 40),
  destinatario text not null check (char_length(destinatario) between 1 and 120),
  telefono text not null check (telefono ~ '^[0-9+ ()-]{7,20}$'),
  provincia text not null check (char_length(provincia) between 2 and 60),
  ciudad text not null check (char_length(ciudad) between 1 and 80),
  direccion text not null check (char_length(direccion) between 5 and 200),
  referencia text check (referencia is null or char_length(referencia) <= 200),
  es_predeterminada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_user_idx on public.customer_addresses (user_id, created_at);
create unique index customer_addresses_one_default
  on public.customer_addresses (user_id) where es_predeterminada;

create trigger customer_addresses_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- Máximo 10 direcciones por cuenta.
create function public.customer_addresses_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.customer_addresses where user_id = new.user_id) >= 10 then
    raise exception 'Máximo 10 direcciones por cuenta' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger customer_addresses_limit
  before insert on public.customer_addresses
  for each row execute function public.customer_addresses_limit();

-- Una sola dirección predeterminada: al marcar una, las demás dejan de serlo.
create function public.customer_addresses_single_default()
returns trigger
language plpgsql
as $$
begin
  update public.customer_addresses
     set es_predeterminada = false
   where user_id = new.user_id and id <> new.id and es_predeterminada;
  return new;
end;
$$;

create trigger customer_addresses_single_default
  before insert or update of es_predeterminada on public.customer_addresses
  for each row when (new.es_predeterminada)
  execute function public.customer_addresses_single_default();

alter table public.customer_addresses enable row level security;

revoke all on public.customer_addresses from anon, authenticated;
revoke all on function public.customer_addresses_limit() from public, anon, authenticated;
revoke all on function public.customer_addresses_single_default() from public, anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
-- El servidor las leerá al crear pedidos (checkout).
grant select on public.customer_addresses to service_role;

create policy customer_addresses_owner on public.customer_addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
