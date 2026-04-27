-- Perfil extendido del usuario
-- auth.users es manejado por Supabase Auth, esta tabla lo extiende

create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  nombre       text,
  empresa      text,
  rut          text,
  role         text not null default 'user',      -- 'user' | 'admin'
  plan         text not null default 'free',      -- 'free' | 'pro' | 'agencia'
  plan_status  text not null default 'active',    -- 'active' | 'trial' | 'cancelled'
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

-- Cada usuario lee y edita solo su propio perfil
create policy "Perfil propio"
  on public.profiles for all
  using (auth.uid() = id);

-- El admin puede leer todos los perfiles
create policy "Admin lee todo"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
