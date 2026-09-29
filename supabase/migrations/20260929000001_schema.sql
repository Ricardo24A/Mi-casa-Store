-- Fase 1 · Esquema base (CLAUDE.md sección 9).
-- Permisos y RLS: 20260929000002_rls_grants.sql. Buckets: 20260929000003_storage.sql.

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'customer');
create type public.discount_type as enum ('porcentaje', 'monto_fijo');
create type public.discount_scope as enum ('producto', 'categoria', 'tienda');
create type public.order_status as enum (
  'pendiente_pago',
  'comprobante_recibido',
  'pagado',
  'enviado',
  'entregado',
  'rechazado',
  'cancelado',
  'vencido'
);
create type public.proof_status as enum ('en_revision', 'aprobado', 'rechazado');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Todo usuario nuevo nace como 'customer'. El rol admin se asigna solo a mano en la
-- base de datos (ver supabase/README.md), nunca desde datos que envíe el usuario.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories (categoría → subcategoría)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  nombre text not null check (char_length(nombre) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Ruta en el bucket público 'product-images'. La sube el dueño.
  imagen_url text check (imagen_url is null or char_length(imagen_url) <= 500),
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create index categories_parent_idx on public.categories (parent_id, orden);

-- ---------------------------------------------------------------------------
-- product_templates (productos comunes precargados)
-- ---------------------------------------------------------------------------
create table public.product_templates (
  id uuid primary key default gen_random_uuid(),
  -- Siempre una subcategoría.
  category_id uuid not null references public.categories (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 120),
  descripcion_base text not null default '' check (char_length(descripcion_base) <= 2000),
  precio_sugerido numeric(10, 2) check (precio_sugerido is null or precio_sugerido > 0),
  -- Prefijo del SKU, p. ej. 'COC-ESP-'. No es único: el dueño completa el sufijo.
  prefijo_sku text check (prefijo_sku is null or char_length(prefijo_sku) <= 32),
  created_at timestamptz not null default now(),
  unique (category_id, nombre)
);

create index product_templates_category_idx on public.product_templates (category_id);

-- ---------------------------------------------------------------------------
-- products (el precio lo decide libremente el dueño; solo debe ser mayor que 0)
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  nombre text not null check (char_length(nombre) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descripcion text not null default '' check (char_length(descripcion) <= 5000),
  precio numeric(10, 2) not null check (precio > 0),
  stock integer not null default 0 check (stock >= 0),
  -- Unidades apartadas por pedidos pendientes de pago (Fase 4).
  stock_reservado integer not null default 0 check (stock_reservado >= 0),
  sku text unique check (sku is null or char_length(sku) between 1 and 64),
  activo boolean not null default true,
  destacado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_reserva_valida check (stock_reservado <= stock)
);

create index products_category_idx on public.products (category_id) where activo;
create index products_activo_idx on public.products (activo, created_at desc);
create index products_destacado_idx on public.products (destacado) where activo and destacado;

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Ruta en el bucket público 'product-images'.
  url text not null check (char_length(url) between 1 and 500),
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, orden);

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  tipo public.discount_type not null,
  valor numeric(10, 2) not null check (valor > 0),
  alcance public.discount_scope not null,
  -- products.id o categories.id según el alcance; null si es de toda la tienda.
  target_id uuid,
  -- Cupón opcional. Sin código = descuento automático.
  codigo text check (codigo is null or codigo ~ '^[A-Z0-9_-]{3,32}$'),
  inicia timestamptz not null default now(),
  termina timestamptz,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discounts_porcentaje_valido check (tipo <> 'porcentaje' or valor <= 100),
  constraint discounts_target_coherente check (
    (alcance = 'tienda' and target_id is null)
    or (alcance <> 'tienda' and target_id is not null)
  ),
  constraint discounts_fechas_validas check (termina is null or termina > inicia)
);

create unique index discounts_codigo_key on public.discounts (codigo) where codigo is not null;
create index discounts_vigencia_idx on public.discounts (activo, inicia, termina);

create trigger discounts_updated_at
  before update on public.discounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Código corto para el concepto de la transferencia; lo genera el trigger de abajo.
  referencia text not null unique default '',
  -- Cuenta opcional: null = compra como invitado.
  user_id uuid references auth.users (id) on delete set null,
  contacto_nombre text not null check (char_length(contacto_nombre) between 1 and 120),
  contacto_email text not null check (char_length(contacto_email) between 3 and 254),
  contacto_telefono text not null check (char_length(contacto_telefono) between 5 and 30),
  -- Cédula o RUC, si el cliente decide pedirlo (pendiente).
  documento text check (documento is null or char_length(documento) <= 20),
  -- { provincia, ciudad, direccion, referencia } validado con Zod en el servidor.
  direccion_envio jsonb not null default '{}'::jsonb,
  -- Secreto para que un invitado consulte su pedido; solo lo usa el servidor.
  access_token uuid not null default gen_random_uuid(),
  estado public.order_status not null default 'pendiente_pago',
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  descuento numeric(10, 2) not null default 0 check (descuento >= 0),
  descuento_transferencia numeric(10, 2) not null default 0 check (descuento_transferencia >= 0),
  envio numeric(10, 2) not null default 0 check (envio >= 0),
  total numeric(10, 2) not null check (total >= 0),
  cupon text,
  notas text check (notas is null or char_length(notas) <= 1000),
  vence_en timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_coherente
    check (total = subtotal - descuento - descuento_transferencia + envio)
);

create function public.generate_order_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- Sin 0/O/1/I para evitar confusiones al copiarla.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ref text;
  i integer;
begin
  loop
    ref := 'MC-';
    for i in 1..8 loop
      ref := ref || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.orders where referencia = ref);
  end loop;
  return ref;
end;
$$;

create function public.orders_set_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.referencia is null or new.referencia = '' then
    new.referencia := public.generate_order_reference();
  end if;
  return new;
end;
$$;

create trigger orders_reference
  before insert on public.orders
  for each row execute function public.orders_set_reference();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_estado_idx on public.orders (estado, created_at desc);
-- Para el vencimiento automático (Fase 4).
create index orders_vencimiento_idx on public.orders (vence_en) where estado = 'pendiente_pago';

-- Precio y nombre congelados al momento de la compra.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  nombre text not null,
  precio_unitario numeric(10, 2) not null check (precio_unitario >= 0),
  cantidad integer not null check (cantidad between 1 and 100)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- payment_proofs
-- ---------------------------------------------------------------------------
create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Ruta en el bucket privado 'payment-proofs' (nombre generado por el servidor).
  archivo text not null check (char_length(archivo) between 1 and 500),
  -- SHA-256 del contenido, para detectar el mismo archivo en varios pedidos.
  hash text not null check (hash ~ '^[a-f0-9]{64}$'),
  estado public.proof_status not null default 'en_revision',
  motivo text check (motivo is null or char_length(motivo) <= 500),
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_en timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_proofs_rechazo_con_motivo
    check (estado <> 'rechazado' or (motivo is not null and char_length(motivo) > 0))
);

create index payment_proofs_order_idx on public.payment_proofs (order_id, created_at desc);
create index payment_proofs_hash_idx on public.payment_proofs (hash);

-- El comprobante es obligatorio: un pedido no puede pasar a 'comprobante_recibido'
-- sin tener uno, ni a 'pagado' sin uno aprobado (aunque falle el código de la app).
create function public.orders_check_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if new.estado = 'comprobante_recibido' and not exists (
    select 1 from public.payment_proofs where order_id = new.id
  ) then
    raise exception 'El pedido % no tiene comprobante', new.referencia
      using errcode = 'check_violation';
  end if;

  if new.estado = 'pagado' and not exists (
    select 1 from public.payment_proofs where order_id = new.id and estado = 'aprobado'
  ) then
    raise exception 'El pedido % no tiene un comprobante aprobado', new.referencia
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger orders_require_proof
  before update of estado on public.orders
  for each row execute function public.orders_check_proof();

-- ---------------------------------------------------------------------------
-- store_settings (una sola fila)
-- ---------------------------------------------------------------------------
create table public.store_settings (
  id boolean primary key default true check (id),
  nombre_negocio text not null default 'Mi casa Store',
  email_contacto text,
  telefono text,
  direccion text,
  -- [{ banco, tipo, numero, titular, identificacion }] validado con Zod al guardar.
  cuentas_bancarias jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cuentas_bancarias) = 'array'),
  costo_envio numeric(10, 2) not null default 0 check (costo_envio >= 0),
  -- Envío gratis desde este monto; null = sin envío gratis (política pendiente).
  envio_gratis_desde numeric(10, 2) check (envio_gratis_desde is null or envio_gratis_desde > 0),
  -- Descuento por pagar con transferencia, en %. 0 = desactivado.
  descuento_transferencia_pct numeric(5, 2) not null default 0
    check (descuento_transferencia_pct between 0 and 100),
  horas_limite_pago integer not null default 48 check (horas_limite_pago between 1 and 336),
  updated_at timestamptz not null default now()
);

create trigger store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (id) values (true);
