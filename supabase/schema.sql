-- FYL Database Schema
-- Ejecutar en Supabase SQL Editor

-- Perfil extendido del usuario (auth.users lo maneja Supabase Auth)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nombre text,
  empresa text,
  rut text,
  created_at timestamptz default now()
);

-- Oportunidades scrapeadas (escribe el scraper, lee el portal)
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  fuente text not null,           -- 'mercado_publico', 'corfo', 'sercotec', etc.
  url text,
  fecha_publicacion timestamptz,
  fecha_cierre timestamptz,
  monto_min bigint,               -- en CLP
  monto_max bigint,
  region text,
  categoria text,
  raw_data jsonb,                 -- payload original sin procesar
  created_at timestamptz default now()
);

-- Configuración de alertas por usuario
create table public.alert_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  categorias text[] default '{}',
  regiones text[] default '{}',
  monto_min bigint default 0,
  monto_max bigint default 0,     -- 0 = sin límite
  palabras_clave text[] default '{}',
  updated_at timestamptz default now()
);

-- Matches entre oportunidades y usuarios
create table public.alert_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  score numeric(4,2),             -- 0.00 a 1.00
  visto boolean default false,
  created_at timestamptz default now(),
  unique(user_id, opportunity_id)
);

-- RLS (Row Level Security): cada usuario solo ve sus datos
alter table public.profiles enable row level security;
alter table public.alert_configs enable row level security;
alter table public.alert_matches enable row level security;
alter table public.opportunities enable row level security;

create policy "Perfil propio" on public.profiles
  for all using (auth.uid() = id);

create policy "Config propia" on public.alert_configs
  for all using (auth.uid() = user_id);

create policy "Matches propios" on public.alert_matches
  for all using (auth.uid() = user_id);

create policy "Oportunidades públicas" on public.opportunities
  for select using (true);       -- todos los autenticados pueden leer oportunidades
