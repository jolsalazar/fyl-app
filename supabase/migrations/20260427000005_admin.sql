-- Asegurar columnas en profiles por si la tabla existía antes de las migraciones
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists plan_status text not null default 'active';

-- Tabla de configuración de fuentes del scrapper
create table public.scraper_config (
  fuente      text primary key,
  nombre      text not null,
  activo      boolean default true,
  updated_at  timestamptz default now(),
  updated_by  uuid references auth.users(id)
);

insert into public.scraper_config (fuente, nombre) values
  ('corfo',          'CORFO'),
  ('sercotec',       'SERCOTEC'),
  ('anid',           'ANID'),
  ('mercadopublico', 'Mercado Público'),
  ('fondos_gob',     'Fondos.gob.cl');

alter table public.scraper_config enable row level security;

-- Solo admins pueden leer y modificar
create policy "Admin gestiona fuentes"
  on public.scraper_config for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Función para que el admin liste usuarios con email (segura, server-side)
create or replace function public.admin_get_users()
returns table (
  id          uuid,
  email       text,
  plan        text,
  role        text,
  plan_status text,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, u.email, p.plan, p.role, p.plan_status, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where (select role from public.profiles where id = auth.uid()) = 'admin'
  order by p.created_at desc;
$$;
