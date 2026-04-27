-- Configuración de alertas por usuario

create table public.alert_configs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade unique,
  categorias     text[] default '{}',
  regiones       text[] default '{}',
  monto_min      bigint default 0,
  monto_max      bigint default 0,   -- 0 = sin límite
  palabras_clave text[] default '{}',
  updated_at     timestamptz default now()
);

alter table public.alert_configs enable row level security;

create policy "Config propia"
  on public.alert_configs for all
  using (auth.uid() = user_id);

create policy "Admin lee configs"
  on public.alert_configs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
